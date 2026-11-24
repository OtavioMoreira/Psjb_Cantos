import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/buildApp.js";
import type { ExternalPsalm } from "../../src/interfaces/index.js";
import { makeTestContainer } from "../support/inMemory.js";

const SECRET = "segredo-do-cron-com-mais-de-16";
let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
let token: string;
const ids: Record<string, number> = {};

// "PDF" de teste: o FakePdfReader lê o próprio texto, linha a linha.
const SALMO_79 = [
  "SALMO 79",
  "1° Domingo do Advento",
  "A D E A",
  "Refrão: I - lu-mi-nai a vos-sa fa-ce so-bre nós, con-ver-tei-nos, pa-ra que se-ja-mos sal-vos!",
  "1. a) Ó Pastor de Israel prestai ouvidos, +",
  "Vós que sobre os queru - bins vos assen - tais,",
  "b) Despertai vosso po - der, ó nosso Deus",
  "1. a) aparecei cheio de glória e esplen - dor!",
  "b) e vinde logo nos tra - zer a salva - ção!",
].join("\n");
const ACLAMACAO_ADVENTO = [
  "ACLAMAÇÃO AO EVANGELHO",
  "M.: Ronaldo Adriano Trindade",
  "D A/C Bm G A D",
  "A - le - lu - ia, A - le - lu - ia!",
  "1° dom.",
  "Mostrai-nos,ó Se - nhor, vossa bon - dade,",
  "2° dom. Preparai o ca - minho do Se - nhor;",
  "1° dom.",
  "e a vossa salvação nos con - ce - dei!",
  "2° dom. endireitai su - as ve - redas.",
].join("\n");

function item(asset: number, title: string, date: string, pdf = SALMO_79): ExternalPsalm {
  const pdfUrl = `https://storage.unitas.app.br/1/DocumentAssets/${asset}/documents/original/x.pdf`;
  const audioUrl = `https://storage.unitas.app.br/1/DocumentAssets/${asset + 1000}/documents/original/x.mp3`;
  adapters.psalmSource.files.set(pdfUrl, Buffer.from(pdf));
  adapters.psalmSource.files.set(audioUrl, Buffer.from("ID3 audio"));
  return { externalId: `${asset}@${date}`, title, date, pdfUrl, audioUrl };
}

const req = (method: "GET" | "POST" | "PATCH", url: string, payload?: object, headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
  app.inject({ method, url: `/api${url}`, headers, payload });
const run = async (days = 10) => (await req("POST", "/admin/imports/run", { days })).json();

beforeEach(async () => {
  const t = makeTestContainer({ CRON_SECRET: SECRET });
  adapters = t.adapters;
  // "Hoje" é segunda, 23/11/2026: a semana pega o 1º Domingo do Advento (29/11).
  adapters.clock.now = () => new Date("2026-11-23T06:00:00Z");
  app = await buildApp({ container: t.container, logger: false });
  for (const [group, slug] of [["momento", "salmo"], ["momento", "aclamacao"], ["tempo", "advento"], ["tempo", "natal"], ["ano", "A"], ["ano", "B"], ["ano", "C"]])
    ids[`${group}:${slug}`] = (await adapters.flags.create({ group: group as "ano", slug, name: slug, color: null, position: 0 })).id;
  await adapters.users.create({ name: "Admin", email: "admin@psjb.org.br", passwordHash: await adapters.hasher.hash("senha1234"), phone: null, movementId: null, status: "active", roles: ["admin", "musico"] });
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "admin@psjb.org.br", password: "senha1234" } })).json().accessToken;
});

const song = (title: string, flags: string[]) =>
  adapters.songs.create(
    { number: null, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), title, composer: null, key: null, lyrics: "x", media: { audio: null, audiomack: null, cifraPdf: null, partituraPdf: null }, flagIds: flags.map((f) => ids[f]), active: true },
    null,
  );

describe("Importação de salmos: canto novo", () => {
  it("cria oculto, com letra do PDF, partitura e áudio copiados, flags, tom, fonte; e não repete", async () => {
    adapters.psalmSource.list = [item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29")];
    const r = await run();
    expect(r.summary).toMatchObject({ created: 1, linked: 0, review: 0, failed: 0, skipped: 0 });

    const s = adapters.songs.rows[0];
    expect(s).toMatchObject({ title: "1º Domingo do Advento, Ano B - Salmo 79", active: false, key: "A", source: { name: "Diocese de Montenegro" } });
    expect(s.flags.map((f) => `${f.group}:${f.slug}`).sort()).toEqual(["ano:B", "momento:salmo", "tempo:advento"]);
    expect(s.lyrics).toBe(
      "**Iluminai a vossa face sobre nós, convertei-nos, para que sejamos salvos!**\n\n" +
        "1. Ó Pastor de Israel prestai ouvidos,\nVós que sobre os querubins vos assentais,\naparecei cheio de glória e esplendor!\n" +
        "Despertai vosso poder, ó nosso Deus\ne vinde logo nos trazer a salvação!",
    );
    expect(s.media.partituraPdf).toMatch(/songs\/\d+\/partitura-pdf-diocese\.pdf/);
    expect(s.media.audio).toMatch(/songs\/\d+\/audio-diocese\.mp3/);

    // 1ª camada: rodar de novo (outro dia da semana) não cria nada nem baixa de novo.
    const downloads = adapters.psalmSource.downloads.length;
    expect((await run()).summary).toMatchObject({ created: 0, skipped: 1 });
    expect(adapters.songs.rows).toHaveLength(1);
    expect(adapters.psalmSource.downloads).toHaveLength(downloads);
  });

  it("PDF escaneado (sem texto): cria sem letra e avisa para digitar antes de aprovar", async () => {
    adapters.psalmSource.list = [item(1354, "Nosso Senhor Jesus Cristo, Rei do Universo | Salmo 22", "2026-11-26", "")];
    const r = await run();
    expect(r.items[0]).toMatchObject({ outcome: "created", message: expect.stringContaining("PDF escaneado") });
    expect(adapters.songs.rows[0]).toMatchObject({ lyrics: "", active: false });
  });

  it("só pega a janela da semana (hoje até N dias)", async () => {
    adapters.psalmSource.list = [
      item(1, "33º Domingo do Tempo Comum | Salmo 127", "2026-11-15"),
      item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29"),
      item(3, "3º Domingo do Advento, Ano B | Salmo Lc 1,46", "2026-12-13"),
    ];
    expect((await run(10)).items.map((i: { date: string }) => i.date)).toEqual(["2026-11-29"]);
  });
});

describe("Importação de salmos: sem duplicados", () => {
  it("3ª camada: o mesmo PDF para outro domingo vira o mesmo canto (e ganha o que faltava)", async () => {
    adapters.psalmSource.list = [
      item(153, "1º Domingo do Advento, Ano B | Aclamação ao Evangelho", "2026-11-29", ACLAMACAO_ADVENTO),
      item(361, "2º Domingo do Advento, Ano B | Aclamação ao Evangelho", "2026-12-06", ACLAMACAO_ADVENTO),
    ];
    const r = await run(20);
    expect(r.summary).toMatchObject({ created: 1, linked: 1 });
    expect(adapters.songs.rows).toHaveLength(1);
    const s = adapters.songs.rows[0];
    expect(s.composer).toBe("Ronaldo Adriano Trindade");
    expect(s.lyrics).toBe(
      "**Aleluia, Aleluia!**\n\n1º Dom.: Mostrai-nos, ó Senhor, vossa bondade, e a vossa salvação nos concedei!\n\n" +
        "2º Dom.: Preparai o caminho do Senhor; endireitai suas veredas.",
    );
  });

  it("o mesmo PDF em festas que já têm canto no repertório: cada uma fica com o seu (não cruza)", async () => {
    const natal = await song("Aclamação Natal dia", ["momento:aclamacao", "tempo:natal", "ano:B"]);
    const familia = await song("Aclamação Sagrada Família", ["momento:aclamacao", "tempo:natal", "ano:B"]);
    adapters.clock.now = () => new Date("2026-12-21T06:00:00Z");
    adapters.psalmSource.list = [
      item(487, "Dia de Natal | Aclamação ao Evangelho", "2026-12-25", ACLAMACAO_ADVENTO),
      item(489, "Sagrada Família | Aclamação ao Evangelho", "2026-12-27", ACLAMACAO_ADVENTO),
    ];
    const r = await run();
    expect(r.items.map((i: { songId: number }) => i.songId)).toEqual([natal.id, familia.id]);
    expect(adapters.songs.rows).toHaveLength(2);
  });

  it("2ª camada: reconhece o canto do site antigo (outro jeito de escrever) e não cria", async () => {
    const old = await song("Advento 4º Dom - Salmo 088", ["momento:salmo", "tempo:advento", "ano:B"]);
    adapters.clock.now = () => new Date("2026-12-14T06:00:00Z");
    adapters.psalmSource.list = [item(88, "4º Domingo do Advento, Ano B | Salmo 88", "2026-12-20")];
    const r = await run();
    expect(r.summary).toMatchObject({ linked: 1, created: 0 });
    expect(r.items[0].songId).toBe(old.id);
    expect(adapters.songs.rows).toHaveLength(1);
  });

  it("canto genérico (sem celebração no título) não é confundido com a aclamação de uma festa", async () => {
    await song("A palavra de Deus vai chegando", ["momento:aclamacao"]);
    adapters.psalmSource.list = [item(153, "1º Domingo do Advento, Ano B | Aclamação ao Evangelho", "2026-11-29", ACLAMACAO_ADVENTO)];
    expect((await run()).summary).toMatchObject({ created: 1, linked: 0 });
  });

  it("o mesmo domingo de outro ano (C) não é o mesmo canto", async () => {
    await song("Advento 1º Dom - Salmo 079", ["momento:salmo", "tempo:advento", "ano:C"]);
    adapters.psalmSource.list = [item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29")];
    expect((await run()).summary).toMatchObject({ created: 1 });
  });

  it("4ª camada: mesma celebração com outro salmo vai para a revisão, com os candidatos", async () => {
    const old = await song("Advento 1º Dom - Salmo 024", ["momento:salmo", "tempo:advento", "ano:B"]);
    adapters.psalmSource.list = [item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29")];
    const r = await run();
    expect(r.summary).toMatchObject({ review: 1, created: 0 });
    expect(adapters.imports.items[0]).toMatchObject({ status: "review", candidateSongIds: [old.id] });
    expect(adapters.songs.rows).toHaveLength(1);
  });

  it("celebração desconhecida também vai para a revisão", async () => {
    adapters.psalmSource.list = [item(5, "Dedicação da Igreja | Salmo 45", "2026-11-25", "SALMO 45\nRefrão: Os rios alegram a cidade de Deus")];
    expect((await run()).summary).toMatchObject({ review: 1 });
  });

  it("falha num item não para os outros; na próxima execução ele é tentado de novo", async () => {
    const bad = item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29");
    adapters.psalmSource.files.delete(bad.pdfUrl!);
    adapters.psalmSource.list = [bad, item(153, "1º Domingo do Advento, Ano B | Aclamação ao Evangelho", "2026-11-29", ACLAMACAO_ADVENTO)];
    expect((await run()).summary).toMatchObject({ failed: 1, created: 1 });
    adapters.psalmSource.files.set(bad.pdfUrl!, Buffer.from(SALMO_79));
    expect((await run()).summary).toMatchObject({ created: 1, skipped: 1 });
  });

  it("fonte fora do ar: 502 e a execução fica registrada com o erro", async () => {
    adapters.psalmSource.fail = new Error("timeout");
    const res = await req("POST", "/admin/imports/run", {});
    expect(res.statusCode).toBe(502);
    expect(adapters.imports.runs[0].error).toBe("timeout");
  });
});

describe("Revisão no admin", () => {
  async function review() {
    await song("Advento 1º Dom - Salmo 024", ["momento:salmo", "tempo:advento", "ano:B"]);
    adapters.psalmSource.list = [item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29")];
    await run();
    return adapters.imports.items[0].id;
  }

  it("lista itens e execuções; 'é este canto' liga; resolver de novo dá 409", async () => {
    const id = await review();
    const list = (await req("GET", "/admin/imports?status=review")).json();
    expect(list.items).toHaveLength(1);
    expect(list.runs[0]).toMatchObject({ trigger: "manual", summary: { review: 1 } });
    const target = adapters.songs.rows[0].id;
    expect((await req("PATCH", `/admin/imports/${id}`, { action: "link", songId: target })).json().item).toMatchObject({ status: "linked", songId: target });
    expect((await req("PATCH", `/admin/imports/${id}`, { action: "ignore" })).statusCode).toBe(409);
  });

  it("'é um canto novo' cria (oculto); 'ignorar' marca e a rotina não volta a ele", async () => {
    const id = await review();
    expect((await req("PATCH", `/admin/imports/${id}`, { action: "create" })).json().item.status).toBe("created");
    expect(adapters.songs.rows.map((s) => s.title)).toContain("1º Domingo do Advento, Ano B - Salmo 79");

    adapters.psalmSource.list = [item(5, "Dedicação da Igreja | Salmo 45", "2026-11-25", "SALMO 45\nRefrão: Os rios alegram a cidade de Deus")];
    await run();
    const other = adapters.imports.items.find((i) => i.externalId === "5@2026-11-25")!;
    expect((await req("PATCH", `/admin/imports/${other.id}`, { action: "ignore" })).json().item.status).toBe("ignored");
    expect((await run()).summary).toMatchObject({ skipped: 1, review: 0 });
  });
});

describe("Cron da Vercel", () => {
  it("só com o CRON_SECRET; token de admin não serve", async () => {
    adapters.psalmSource.list = [item(359, "1º Domingo do Advento, Ano B | Salmo 79", "2026-11-29")];
    expect((await req("GET", "/cron/import-psalms", undefined, {})).statusCode).toBe(401);
    expect((await req("GET", "/cron/import-psalms", undefined, { authorization: "Bearer errado" })).statusCode).toBe(401);
    expect((await req("GET", "/cron/import-psalms")).statusCode).toBe(401);
    const ok = await req("GET", "/cron/import-psalms", undefined, { authorization: `Bearer ${SECRET}` });
    expect(ok.json()).toMatchObject({ ok: true, summary: { created: 1 } });
    expect(adapters.imports.runs[0].trigger).toBe("cron");
  });

  it("faxina diária: só com o CRON_SECRET; apaga o que venceu há mais de 7 dias", async () => {
    expect((await req("GET", "/cron/cleanup", undefined, {})).statusCode).toBe(401);
    expect((await req("GET", "/cron/cleanup")).statusCode).toBe(401);
    const ok = await req("GET", "/cron/cleanup", undefined, { authorization: `Bearer ${SECRET}` });
    expect(ok.json()).toEqual({ ok: true, removed: { sessions: 1, authTokens: 2, trustedDevices: 3, auditLog: 4 } });
    expect(adapters.maintenance.calls[0].graceDays).toBe(7);
  });

  it("sem CRON_SECRET configurado, a rota responde 501", async () => {
    const t = makeTestContainer();
    const other = await buildApp({ container: t.container, logger: false });
    expect((await other.inject({ method: "GET", url: "/api/cron/import-psalms", headers: { authorization: "Bearer x" } })).statusCode).toBe(501);
  });
});
