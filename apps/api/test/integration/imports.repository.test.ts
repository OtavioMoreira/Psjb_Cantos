import { describe, expect, it } from "vitest";
import type { ImportItemData } from "../../src/interfaces/index.js";
import { dbUrl, useTestDb } from "../support/db.js";

const item = (over: Partial<ImportItemData> = {}): ImportItemData => ({
  source: "diocese-montenegro",
  externalId: "359@2026-11-29",
  title: "1º Domingo do Advento, Ano B | Salmo 79",
  kind: "salmo",
  celebrationDate: "2026-11-29",
  pdfUrl: "https://x/a.pdf",
  audioUrl: "https://x/a.mp3",
  pdfHash: "a".repeat(64),
  status: "created",
  songId: null,
  candidateSongIds: [],
  message: null,
  ...over,
});

describe.skipIf(!dbUrl)("PgImportRepository", () => {
  const { repos, factory } = useTestDb();

  it("grava, encontra pela fonte + id e atualiza no mesmo registro (sem duplicar)", async () => {
    const a = await repos.imports.saveItem(item({ status: "failed", message: "timeout" }));
    expect(a).toMatchObject({ celebrationDate: "2026-11-29", status: "failed", candidateSongIds: [] });
    const b = await repos.imports.saveItem(item({ status: "review", candidateSongIds: [3, 4], message: "dúvida" }));
    expect(b.id).toBe(a.id);
    expect(await repos.imports.findItem("diocese-montenegro", "359@2026-11-29")).toMatchObject({ status: "review", candidateSongIds: [3, 4] });
    expect(await repos.imports.findItem("outra-fonte", "359@2026-11-29")).toBeNull();
    expect((await repos.imports.listItems({ limit: 10 })).length).toBe(1);
  });

  it("acha o canto pelo hash do PDF só em itens que a rotina criou; o canto excluído solta o item", async () => {
    const s = await factory.song({ title: "Salmo importado", source: { name: "Diocese de Montenegro", url: "https://d" } }, null);
    expect(s.source).toEqual({ name: "Diocese de Montenegro", url: "https://d" });
    await repos.imports.saveItem(item({ externalId: "1@x", status: "review", songId: s.id, pdfHash: "b".repeat(64) }));
    expect(await repos.imports.songIdByPdfHash("diocese-montenegro", "b".repeat(64))).toBeNull();
    // Reconhecido no repertório antigo: não serve para outras celebrações.
    await repos.imports.saveItem(item({ externalId: "2@x", status: "linked", songId: s.id, pdfHash: "b".repeat(64) }));
    expect(await repos.imports.songIdByPdfHash("diocese-montenegro", "b".repeat(64))).toBeNull();
    await repos.imports.saveItem(item({ externalId: "3@x", status: "created", songId: s.id, pdfHash: "b".repeat(64) }));
    expect(await repos.imports.songIdByPdfHash("diocese-montenegro", "b".repeat(64))).toBe(s.id);
    await repos.songs.delete(s.id);
    expect(await repos.imports.songIdByPdfHash("diocese-montenegro", "b".repeat(64))).toBeNull();
    expect((await repos.imports.findItem("diocese-montenegro", "3@x"))?.songId).toBeNull();
  });

  it("filtra por status e registra as execuções, da mais nova para a mais antiga", async () => {
    await repos.imports.saveItem(item({ externalId: "1@x", status: "review" }));
    await repos.imports.saveItem(item({ externalId: "2@x", status: "created" }));
    expect((await repos.imports.listItems({ status: "review", limit: 10 })).map((i) => i.externalId)).toEqual(["1@x"]);
    const r1 = await repos.imports.startRun("diocese-montenegro", "cron");
    await repos.imports.finishRun(r1, { created: 1 }, null);
    const r2 = await repos.imports.startRun("diocese-montenegro", "manual");
    await repos.imports.finishRun(r2, {}, "timeout");
    const runs = await repos.imports.listRuns(5);
    expect(runs.map((r) => [r.trigger, r.error])).toEqual([["manual", "timeout"], ["cron", null]]);
    expect(runs[1].summary).toEqual({ created: 1 });
    expect(runs[1].finishedAt).toBeInstanceOf(Date);
  });

  it("o banco recusa tipo e status inválidos", async () => {
    await expect(repos.imports.saveItem(item({ kind: "hino" as "salmo" }))).rejects.toThrow();
    await expect(repos.imports.saveItem(item({ status: "feito" as "created" }))).rejects.toThrow();
  });

  it("canto sem fonte continua com source null; update não apaga a fonte", async () => {
    const s = await factory.song({ title: "Com fonte", source: { name: "Diocese", url: "https://d" } }, null);
    const u = await repos.songs.update(s.id, { number: null, slug: s.slug, title: "Com fonte (editado)", composer: null, key: null, lyrics: "", media: s.media, flagIds: [], active: true }, null);
    expect(u?.source).toEqual({ name: "Diocese", url: "https://d" });
    expect((await factory.song({ title: "Sem fonte" }, null)).source).toBeNull();
  });
});
