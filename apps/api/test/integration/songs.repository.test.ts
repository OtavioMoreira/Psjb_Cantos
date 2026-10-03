import { describe, expect, it } from "vitest";
import type { SongFilters } from "../../src/interfaces/index.js";
import { dbUrl, useTestDb } from "../support/db.js";

const all = (over: Partial<SongFilters> = {}): SongFilters => ({ includeInactive: false, page: 1, pageSize: 50, ...over });

describe.skipIf(!dbUrl)("PgFlagRepository", () => {
  const { repos, factory } = useTestDb();

  it("lista na ordem dos grupos (momento, tempo, ano, tema, outro) e depois pela posição", async () => {
    await repos.flags.create({ group: "outro", slug: "x", name: "X", color: null, position: 0 });
    await repos.flags.create({ group: "ano", slug: "B", name: "Ano B", color: null, position: 2 });
    await repos.flags.create({ group: "ano", slug: "A", name: "Ano A", color: null, position: 1 });
    await repos.flags.create({ group: "momento", slug: "entrada", name: "Entrada", color: null, position: 1 });
    await repos.flags.create({ group: "tempo", slug: "advento", name: "Advento", color: "#5B2C83", position: 1 });
    expect((await repos.flags.list()).map((f) => `${f.group}:${f.slug}`)).toEqual(["momento:entrada", "tempo:advento", "ano:A", "ano:B", "outro:x"]);
  });

  it("slug único dentro do grupo (FLAG_TAKEN), mas pode repetir em outro grupo", async () => {
    await repos.flags.create({ group: "ano", slug: "A", name: "Ano A", color: null, position: 0 });
    await expect(repos.flags.create({ group: "ano", slug: "A", name: "Outra", color: null, position: 0 })).rejects.toMatchObject({ code: "FLAG_TAKEN" });
    await expect(repos.flags.create({ group: "outro", slug: "A", name: "A de outro", color: null, position: 0 })).resolves.toBeTruthy();
  });

  it("o banco recusa slug e cor fora do padrão (CHECK)", async () => {
    await expect(repos.flags.create({ group: "outro", slug: "com espaço", name: "X", color: null, position: 0 })).rejects.toThrow();
    await expect(repos.flags.create({ group: "outro", slug: "ok", name: "X", color: "vermelho", position: 0 })).rejects.toThrow();
  });

  it("excluir a flag tira a etiqueta dos cantos, sem apagar os cantos; a contagem acompanha", async () => {
    const u = await factory.user();
    const f = await repos.flags.create({ group: "tema", slug: "paz", name: "Paz", color: null, position: 0 });
    const s = await factory.song({ title: "Canto da paz", flagIds: [f.id] }, u.id);
    expect((await repos.flags.findByIds([f.id]))[0].songs).toBe(1);
    expect(await repos.flags.delete(f.id)).toBe(true);
    expect((await repos.songs.findById(s.id))?.flags).toEqual([]);
    expect(await repos.flags.delete(f.id)).toBe(false);
  });
});

describe.skipIf(!dbUrl)("PgSongRepository", () => {
  const { repos, factory } = useTestDb();

  async function setup() {
    const u = await factory.user({ roles: ["admin"] });
    const f = async (group: "momento" | "tempo" | "ano", slug: string) => (await repos.flags.create({ group, slug, name: slug, color: null, position: 0 })).id;
    const flags = { adv: await f("tempo", "advento"), nat: await f("tempo", "natal"), ent: await f("momento", "entrada"), com: await f("momento", "comunhao") };
    await factory.song({ title: "A feliz espera", number: 1, flagIds: [flags.adv, flags.ent], lyrics: "**Vem, Senhor**" }, u.id);
    await factory.song({ title: "Noite feliz", number: 2, flagIds: [flags.nat, flags.com] }, u.id);
    await factory.song({ title: "São José", number: 45, flagIds: [flags.adv, flags.com], composer: "João Ninguém" }, u.id);
    await factory.song({ title: "Oculto", number: 99, active: false }, u.id);
    return { u, flags };
  }
  const titles = async (f: Partial<SongFilters>) => (await repos.songs.list(all(f))).songs.map((s) => s.title);

  it("cria com várias flags e mídias e devolve tudo", async () => {
    const u = await factory.user();
    const a = await repos.flags.create({ group: "ano", slug: "A", name: "Ano A", color: null, position: 0 });
    const b = await repos.flags.create({ group: "ano", slug: "B", name: "Ano B", color: null, position: 1 });
    const s = await factory.song(
      { title: "Salmo", key: "F#m", media: { audio: "https://x/a.mp3", audiomack: null, cifraPdf: "https://x/c.pdf", partituraPdf: null }, flagIds: [a.id, b.id] },
      u.id,
    );
    expect(s).toMatchObject({ key: "F#m", media: { audio: "https://x/a.mp3", cifraPdf: "https://x/c.pdf" }, active: true });
    expect(s.flags.map((f) => f.slug)).toEqual(["A", "B"]);
    expect(await repos.songs.findBySlug(s.slug)).toMatchObject({ id: s.id });
  });

  it("número e slug repetidos viram SONG_TAKEN com a mensagem certa", async () => {
    const u = await factory.user();
    await factory.song({ title: "Um", number: 1, slug: "um" }, u.id);
    await expect(factory.song({ title: "Outro", number: 1, slug: "outro" }, u.id)).rejects.toMatchObject({ code: "SONG_TAKEN", message: expect.stringMatching(/número/) });
    await expect(factory.song({ title: "Um de novo", slug: "um" }, u.id)).rejects.toMatchObject({ code: "SONG_TAKEN", message: expect.stringMatching(/slug/) });
  });

  // Regressão: o filtro por flags chegou a não filtrar nada.
  it("filtro por flags: OU dentro do grupo, E entre grupos", async () => {
    const { flags } = await setup();
    expect(await titles({ flagIds: [flags.adv] })).toEqual(["A feliz espera", "São José"]);
    expect(await titles({ flagIds: [flags.adv, flags.nat] })).toEqual(["A feliz espera", "Noite feliz", "São José"]);
    expect(await titles({ flagIds: [flags.adv, flags.nat, flags.com] })).toEqual(["Noite feliz", "São José"]);
    expect(await titles({ flagIds: [999] })).toEqual([]);
  });

  it("busca sem acento em título, autor e letra; número exato; ocultos só com includeInactive", async () => {
    await setup();
    expect(await titles({ q: "sao jose" })).toEqual(["São José"]);
    expect(await titles({ q: "JOAO" })).toEqual(["São José"]);
    expect(await titles({ q: "vem, senhor" })).toEqual(["A feliz espera"]);
    expect(await titles({ q: "45" })).toEqual(["São José"]);
    expect(await titles({ q: "045" })).toEqual(["São José"]);
    expect(await titles({ q: "oculto" })).toEqual([]);
    expect(await titles({ q: "oculto", includeInactive: true })).toEqual(["Oculto"]);
    expect(await titles({ q: "%" })).toEqual([]);
    expect(await titles({ q: "'; DROP TABLE songs; --" })).toEqual([]);
    expect((await repos.songs.list(all())).total).toBe(3);
  });

  it("paginação: o total conta todos os do filtro, não só a página", async () => {
    await setup();
    const page = await repos.songs.list(all({ pageSize: 2, page: 2 }));
    expect(page.total).toBe(3);
    expect(page.songs.map((s) => s.number)).toEqual([45]);
  });

  it("update substitui as flags; setMedia muda um arquivo só; existingIds", async () => {
    const { u, flags } = await setup();
    const s = (await repos.songs.findBySlug("noite-feliz"))!;
    const updated = await repos.songs.update(s.id, { ...s, flagIds: [flags.adv] }, u.id);
    expect(updated?.flags.map((f) => f.slug)).toEqual(["advento"]);
    const withAudio = await repos.songs.setMedia(s.id, "audio", "https://x/novo.mp3", u.id);
    expect(withAudio?.media).toMatchObject({ audio: "https://x/novo.mp3", cifraPdf: null });
    expect(await repos.songs.update(9999, { ...s, flagIds: [] }, u.id)).toBeNull();
    expect((await repos.songs.existingIds([s.id, 9999])).sort()).toEqual([s.id]);
  });

  it("excluir o canto apaga as etiquetas dele (CASCADE) e mantém as flags", async () => {
    const { flags } = await setup();
    const s = (await repos.songs.findBySlug("a-feliz-espera"))!;
    expect(await repos.songs.delete(s.id)).toBe(true);
    expect(await repos.songs.findById(s.id)).toBeNull();
    expect((await repos.flags.findByIds([flags.ent]))[0].songs).toBe(0);
  });
});
