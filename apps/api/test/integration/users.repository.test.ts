import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

describe.skipIf(!dbUrl)("PgUserRepository", () => {
  const { repos, factory, pool } = useTestDb();

  it("cria com papéis e movimento e lê de volta (com o hash só em findByEmailWithPassword)", async () => {
    const mv = await repos.movements.create("Catequese");
    const u = await factory.user({ name: "Ana", email: "ana@teste.com", roles: ["admin", "musico"], movementId: mv.id });
    expect(u).toMatchObject({ name: "Ana", roles: ["admin", "musico"], movement: { id: mv.id, name: "Catequese" }, status: "active" });
    expect(u).not.toHaveProperty("passwordHash");

    expect(await repos.users.findById(u.id)).toMatchObject({ email: "ana@teste.com" });
    expect((await repos.users.findByEmailWithPassword("ana@teste.com"))?.passwordHash).toBe("hash-de-teste");
    expect(await repos.users.findByEmailWithPassword("ninguem@teste.com")).toBeNull();
    expect(await repos.users.emailExists("ana@teste.com")).toBe(true);
  });

  it("e-mail repetido (inclusive em corrida) vira EMAIL_TAKEN, sem deixar papéis órfãos", async () => {
    await factory.user({ email: "dup@teste.com" });
    await expect(factory.user({ email: "dup@teste.com" })).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM user_roles");
    expect(rows[0].n).toBe(1);
  });

  it("lista pendentes, depois bloqueados e ativos; filtra por status, papel e busca (nome, e-mail, movimento)", async () => {
    const mv = await repos.movements.create("Pastoral da Juventude");
    await factory.user({ name: "Zeca", status: "active" });
    await factory.user({ name: "Bia", status: "blocked" });
    await factory.user({ name: "Caio", status: "pending", movementId: mv.id });
    await factory.user({ name: "Admin", roles: ["admin"] });

    expect((await repos.users.list({})).map((u) => u.name)).toEqual(["Caio", "Bia", "Admin", "Zeca"]);
    expect((await repos.users.list({ status: "blocked" })).map((u) => u.name)).toEqual(["Bia"]);
    expect((await repos.users.list({ role: "admin" })).map((u) => u.name)).toEqual(["Admin"]);
    expect((await repos.users.list({ q: "juventude" })).map((u) => u.name)).toEqual(["Caio"]);
  });

  it("busca trata %, _ e aspas como texto (sem curinga nem SQL injection)", async () => {
    await factory.user({ name: "100% Música" });
    await factory.user({ name: "Outra pessoa" });
    expect((await repos.users.list({ q: "%" })).map((u) => u.name)).toEqual(["100% Música"]);
    expect(await repos.users.list({ q: "_" })).toEqual([]);
    expect(await repos.users.list({ q: "' OR 1=1 --" })).toEqual([]);
    expect(await repos.users.searchActive("%' OR '1'='1", "00000000-0000-0000-0000-000000000000", 10)).toEqual([]);
  });

  it("updateStatus, updatePhoto e touchLastLogin", async () => {
    const u = await factory.user({ status: "pending" });
    expect(await repos.users.updateStatus(u.id, "blocked", "Conta duplicada")).toMatchObject({ status: "blocked", blockedReason: "Conta duplicada" });
    expect(await repos.users.updateStatus(u.id, "active", null)).toMatchObject({ status: "active", blockedReason: null });
    expect((await repos.users.updatePhoto(u.id, "https://x/foto.png"))?.photoUrl).toBe("https://x/foto.png");
    await repos.users.touchLastLogin(u.id);
    expect((await repos.users.findById(u.id))?.lastLoginAt).toBeInstanceOf(Date);
    expect(await repos.users.updateStatus("00000000-0000-0000-0000-000000000000", "active")).toBeNull();
  });

  it("filterActiveIds e searchActive só trazem contas ativas, sem a própria pessoa", async () => {
    const me = await factory.user({ name: "Eu Mesma" });
    const ativa = await factory.user({ name: "Ana Ativa" });
    const pendente = await factory.user({ name: "Ana Pendente", status: "pending" });
    const bloqueada = await factory.user({ name: "Ana Bloqueada", status: "blocked" });

    expect(await repos.users.filterActiveIds([ativa.id, pendente.id, bloqueada.id, "00000000-0000-0000-0000-000000000000"])).toEqual([ativa.id]);
    expect(await repos.users.filterActiveIds([])).toEqual([]);
    expect((await repos.users.searchActive("ana", me.id, 10)).map((p) => p.name)).toEqual(["Ana Ativa"]);
    expect((await repos.users.searchActive("", me.id, 10)).map((p) => p.name)).toEqual(["Ana Ativa"]);
  });
});

describe.skipIf(!dbUrl)("PgSessionRepository", () => {
  const { repos, factory, pool } = useTestDb();
  const future = () => new Date(Date.now() + 86_400_000);

  it("cria, acha pelo hash, rotaciona e revoga a família inteira", async () => {
    const u = await factory.user();
    const a = await repos.sessions.create({ userId: u.id, familyId: "11111111-1111-1111-1111-111111111111", tokenHash: "a".repeat(64), expiresAt: future(), remember: true, userAgent: "x".repeat(400) });
    const b = await repos.sessions.create({ userId: u.id, familyId: a.familyId, tokenHash: "b".repeat(64), expiresAt: a.expiresAt, remember: true, userAgent: null });
    await repos.sessions.create({ userId: u.id, familyId: "22222222-2222-2222-2222-222222222222", tokenHash: "c".repeat(64), expiresAt: future(), remember: false, userAgent: null });

    expect(await repos.sessions.findByTokenHash("a".repeat(64))).toMatchObject({ id: a.id, revokedAt: null, remember: true });
    await repos.sessions.rotate(a.id, b.id);
    expect((await repos.sessions.findByTokenHash("a".repeat(64)))?.revokedAt).toBeInstanceOf(Date);

    await repos.sessions.revokeFamily(a.familyId);
    expect((await repos.sessions.findByTokenHash("b".repeat(64)))?.revokedAt).toBeInstanceOf(Date);
    expect((await repos.sessions.findByTokenHash("c".repeat(64)))?.revokedAt).toBeNull(); // outra família intacta

    await repos.sessions.revokeAllForUser(u.id);
    expect((await repos.sessions.findByTokenHash("c".repeat(64)))?.revokedAt).toBeInstanceOf(Date);
  });

  it("token duplicado é recusado pelo banco (UNIQUE)", async () => {
    const u = await factory.user();
    const data = { userId: u.id, familyId: "33333333-3333-3333-3333-333333333333", tokenHash: "d".repeat(64), expiresAt: future(), remember: false, userAgent: null };
    await repos.sessions.create(data);
    await expect(repos.sessions.create(data)).rejects.toThrow();
  });

  it("excluir a pessoa apaga as sessões dela (CASCADE)", async () => {
    const u = await factory.user();
    await repos.sessions.create({ userId: u.id, familyId: "44444444-4444-4444-4444-444444444444", tokenHash: "e".repeat(64), expiresAt: future(), remember: false, userAgent: null });
    await pool.query("DELETE FROM users WHERE id = $1", [u.id]);
    expect(await repos.sessions.findByTokenHash("e".repeat(64))).toBeNull();
  });
});

describe.skipIf(!dbUrl)("PgMovementRepository", () => {
  const { repos, factory } = useTestDb();

  it("lista em ordem alfabética com a contagem de membros", async () => {
    const pj = await repos.movements.create("Pastoral da Juventude");
    await repos.movements.create("Catequese");
    await factory.user({ movementId: pj.id });
    await factory.user({ movementId: pj.id });
    expect((await repos.movements.list()).map((m) => [m.name, m.members])).toEqual([
      ["Catequese", 0],
      ["Pastoral da Juventude", 2],
    ]);
  });

  it("nome único sem diferenciar maiúsculas, ao criar e ao renomear", async () => {
    const a = await repos.movements.create("RCC");
    await expect(repos.movements.create("rcc")).rejects.toMatchObject({ code: "MOVEMENT_TAKEN" });
    const b = await repos.movements.create("Catequese");
    await expect(repos.movements.rename(b.id, "Rcc")).rejects.toMatchObject({ code: "MOVEMENT_TAKEN" });
    expect(await repos.movements.rename(a.id, "Renovação Carismática")).toMatchObject({ name: "Renovação Carismática" });
    expect(await repos.movements.rename(999, "X")).toBeNull();
  });

  it("não exclui movimento com pessoas (MOVEMENT_IN_USE); sem pessoas, exclui", async () => {
    const m = await repos.movements.create("Legião de Maria");
    await factory.user({ movementId: m.id });
    await expect(repos.movements.delete(m.id)).rejects.toMatchObject({ code: "MOVEMENT_IN_USE" });
    expect((await repos.movements.findById(m.id))?.members).toBe(1);
    const vazio = await repos.movements.create("Vazio");
    expect(await repos.movements.delete(vazio.id)).toBe(true);
    expect(await repos.movements.delete(vazio.id)).toBe(false);
  });
});
