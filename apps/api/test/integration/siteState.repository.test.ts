import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

describe.skipIf(!dbUrl)("PgSiteStateRepository (alterações não publicadas)", () => {
  const { repos, factory, pool } = useTestDb();

  // A linha única não entra no TRUNCATE dos testes: começa cada teste "publicada".
  const reset = () => pool.query("UPDATE site_state SET content_changed_at = now() - interval '1 hour', published_at = now() - interval '1 minute'");
  const pending = async () => {
    const s = await repos.siteState.get();
    return !s.publishedAt || s.contentChangedAt > s.publishedAt;
  };

  it("criar, editar e excluir canto ou flag marca a mudança; publicar limpa", async () => {
    await reset();
    expect(await pending()).toBe(false);

    const song = await factory.song({ title: "Canto novo" }, null);
    expect(await pending()).toBe(true);
    const done = await repos.siteState.markPublished("Padre João");
    expect(done.publishedByName).toBe("Padre João");
    expect(await pending()).toBe(false);

    const flag = await repos.flags.create({ group: "tema", slug: "paz", name: "Paz", color: null, position: 0 });
    expect(await pending()).toBe(true);
    await repos.siteState.markPublished("Padre João");

    // Etiqueta no canto (song_flags) também conta.
    const { number, slug, title, composer, key, lyrics, media, active } = song;
    await repos.songs.update(song.id, { number, slug, title, composer, key, lyrics, media, active, flagIds: [flag.id] }, null);
    expect(await pending()).toBe(true);
    await repos.siteState.markPublished("Padre João");

    await repos.songs.delete(song.id);
    expect(await pending()).toBe(true);
  });

  it("UPDATE que não acha nenhuma linha não conta como mudança; mexer em missa ou usuário também não", async () => {
    await reset();
    await pool.query("UPDATE songs SET title = 'x' WHERE id = -1");
    const u = await factory.user();
    await repos.masses.create(u.id, { name: "Missa", date: null, time: null, season: null, year: null, slots: [], suggested: false });
    expect(await pending()).toBe(false);
  });
});
