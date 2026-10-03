import { describe, expect, it } from "vitest";
import type { MassData } from "../../src/interfaces/index.js";
import { dbUrl, useTestDb } from "../support/db.js";

const mass = (over: Partial<MassData> = {}): MassData => ({
  name: "Missa",
  date: null,
  time: null,
  season: null,
  year: null,
  slots: [],
  ...over,
});

/** Data relativa a hoje no fuso de Brasília (o mesmo que o repositório usa para "próximas"). */
async function brDate(pool: { query: (sql: string) => Promise<{ rows: { d: string }[] }> }, days: number) {
  const { rows } = await pool.query(`SELECT to_char((now() AT TIME ZONE 'America/Sao_Paulo')::date + ${days}, 'YYYY-MM-DD') AS d`);
  return rows[0].d;
}

describe.skipIf(!dbUrl)("PgMassRepository", () => {
  const { repos, factory, pool } = useTestDb();

  it("guarda data e hora exatamente como enviadas (sem erro de fuso) e os momentos em JSON", async () => {
    const owner = await factory.user();
    const slots = [{ id: "s1", moment: "entrada" as const, label: "Entrada", items: [{ songId: 77, transpose: -2 }] }];
    const m = await repos.masses.create(owner.id, mass({ date: "2026-12-31", time: "23:30", season: "natal", year: "A", slots }));
    expect(m).toMatchObject({ date: "2026-12-31", time: "23:30", season: "natal", year: "A", slots, sharedWith: [], shareToken: null });
    expect(m.owner).toEqual({ id: owner.id, name: owner.name, photoUrl: null });
  });

  it("aceita o id do front; o mesmo id de novo dá MASS_EXISTS", async () => {
    const owner = await factory.user();
    const id = "6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b";
    expect((await repos.masses.create(owner.id, mass(), id)).id).toBe(id);
    await expect(repos.masses.create(owner.id, mass(), id)).rejects.toMatchObject({ code: "MASS_EXISTS" });
  });

  it("listForUser: minhas + compartilhadas comigo; nunca as dos outros", async () => {
    const [ana, bruno, carla] = [await factory.user(), await factory.user(), await factory.user()];
    const daAna = await repos.masses.create(ana.id, mass({ name: "Da Ana" }));
    await repos.masses.create(bruno.id, mass({ name: "Do Bruno" }));
    await repos.masses.setShares(daAna.id, [carla.id]);

    expect((await repos.masses.listForUser(ana.id, { when: "all" })).map((m) => m.name)).toEqual(["Da Ana"]);
    expect((await repos.masses.listForUser(carla.id, { when: "all" })).map((m) => m.name)).toEqual(["Da Ana"]);
    expect((await repos.masses.listForUser(bruno.id, { when: "all" })).map((m) => m.name)).toEqual(["Do Bruno"]);
  });

  it("filtro de datas: próximas (de hoje em diante e sem data, a mais perto primeiro) e passadas", async () => {
    const u = await factory.user();
    await repos.masses.create(u.id, mass({ name: "Ontem", date: await brDate(pool, -1) }));
    await repos.masses.create(u.id, mass({ name: "Hoje", date: await brDate(pool, 0) }));
    await repos.masses.create(u.id, mass({ name: "Semana que vem", date: await brDate(pool, 7) }));
    await repos.masses.create(u.id, mass({ name: "Sem data" }));

    expect((await repos.masses.listForUser(u.id, { when: "upcoming" })).map((m) => m.name)).toEqual(["Hoje", "Semana que vem", "Sem data"]);
    expect((await repos.masses.listForUser(u.id, { when: "past" })).map((m) => m.name)).toEqual(["Ontem"]);
    expect(await repos.masses.listForUser(u.id, { when: "all" })).toHaveLength(4);
  });

  it("busca pelo nome trata % e _ como texto", async () => {
    const u = await factory.user();
    await repos.masses.create(u.id, mass({ name: "Missa 100%" }));
    await repos.masses.create(u.id, mass({ name: "Outra" }));
    expect((await repos.masses.listForUser(u.id, { when: "all", q: "%" })).map((m) => m.name)).toEqual(["Missa 100%"]);
    expect(await repos.masses.listForUser(u.id, { when: "all", q: "_" })).toEqual([]);
  });

  it("update registra quem editou; delete some com os convites", async () => {
    const [ana, bruno] = [await factory.user(), await factory.user()];
    const m = await repos.masses.create(ana.id, mass());
    await repos.masses.setShares(m.id, [bruno.id]);
    expect(await repos.masses.update(m.id, mass({ name: "Editada" }), bruno.id)).toMatchObject({ name: "Editada" });
    const { rows } = await pool.query("SELECT updated_by FROM masses WHERE id = $1", [m.id]);
    expect(rows[0].updated_by).toBe(bruno.id);
    expect(await repos.masses.update("00000000-0000-0000-0000-000000000000", mass(), ana.id)).toBeNull();

    expect(await repos.masses.delete(m.id)).toBe(true);
    expect((await pool.query("SELECT count(*)::int AS n FROM mass_shares")).rows[0].n).toBe(0);
    expect(await repos.masses.delete(m.id)).toBe(false);
  });

  it("setShares substitui a lista; addShare não duplica; removeShare tira só a pessoa", async () => {
    const [dono, a, b, c] = [await factory.user(), await factory.user({ name: "A" }), await factory.user({ name: "B" }), await factory.user({ name: "C" })];
    const m = await repos.masses.create(dono.id, mass());
    expect((await repos.masses.setShares(m.id, [a.id, b.id]))?.sharedWith.map((p) => p.name)).toEqual(["A", "B"]);
    expect((await repos.masses.setShares(m.id, [b.id, c.id]))?.sharedWith.map((p) => p.name)).toEqual(["B", "C"]);
    await repos.masses.addShare(m.id, c.id);
    await repos.masses.addShare(m.id, a.id);
    await repos.masses.removeShare(m.id, b.id);
    expect((await repos.masses.findById(m.id))?.sharedWith.map((p) => p.name)).toEqual(["A", "C"]);
    expect((await repos.masses.setShares(m.id, []))?.sharedWith).toEqual([]);
  });

  // Regressão: a query do link usava o mesmo parâmetro com dois tipos e dava erro 500.
  it("link de convite: grava, acha pelo token e desativa", async () => {
    const u = await factory.user();
    const m = await repos.masses.create(u.id, mass());
    await repos.masses.setShareToken(m.id, "token-de-teste-1234567890");
    expect((await repos.masses.findByShareToken("token-de-teste-1234567890"))?.id).toBe(m.id);
    const { rows } = await pool.query("SELECT share_token_created_at FROM masses WHERE id = $1", [m.id]);
    expect(rows[0].share_token_created_at).toBeInstanceOf(Date);

    await repos.masses.setShareToken(m.id, null);
    expect(await repos.masses.findByShareToken("token-de-teste-1234567890")).toBeNull();
    expect((await repos.masses.findById(m.id))?.shareToken).toBeNull();
  });

  it("countSongUsage acha o canto em qualquer momento da missa (busca no JSON)", async () => {
    const u = await factory.user();
    const slots = (songId: number) => [
      { id: "a", moment: "entrada" as const, label: "Entrada", items: [{ songId: 1, transpose: 0 }] },
      { id: "b", moment: "comunhao" as const, label: "Comunhão", items: [{ songId, transpose: 3 }] },
    ];
    await repos.masses.create(u.id, mass({ slots: slots(42) }));
    await repos.masses.create(u.id, mass({ slots: slots(42) }));
    await repos.masses.create(u.id, mass({ slots: slots(7) }));
    expect(await repos.masses.countSongUsage(42)).toBe(2);
    expect(await repos.masses.countSongUsage(1)).toBe(3);
    expect(await repos.masses.countSongUsage(999)).toBe(0);
  });

  it("excluir o dono apaga as missas dele; excluir o convidado só tira o convite (CASCADE)", async () => {
    const [dono, convidado] = [await factory.user(), await factory.user()];
    const m = await repos.masses.create(dono.id, mass());
    await repos.masses.setShares(m.id, [convidado.id]);
    await pool.query("DELETE FROM users WHERE id = $1", [convidado.id]);
    expect((await repos.masses.findById(m.id))?.sharedWith).toEqual([]);
    await pool.query("DELETE FROM users WHERE id = $1", [dono.id]);
    expect(await repos.masses.findById(m.id)).toBeNull();
  });

  it("o banco recusa tempo litúrgico e ano inválidos (CHECK)", async () => {
    const u = await factory.user();
    await expect(repos.masses.create(u.id, mass({ season: "carnaval" as never }))).rejects.toThrow();
    await expect(repos.masses.create(u.id, mass({ year: "D" as never }))).rejects.toThrow();
  });
});
