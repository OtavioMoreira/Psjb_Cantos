import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
const tokens: Record<string, string> = {};

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  for (const [key, roles] of [["admin", ["admin", "musico"]], ["ana", ["musico"]]] as const) {
    await adapters.users.create({
      name: key,
      email: `${key}@psjb.org.br`,
      passwordHash: await adapters.hasher.hash("senha1234"),
      phone: null,
      movementId: null,
      status: "active",
      roles: [...roles],
    });
    tokens[key] = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: `${key}@psjb.org.br`, password: "senha1234" } })).json().accessToken;
  }
});

const req = (key: string | null, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url: `/api${url}`, headers: key ? { authorization: `Bearer ${tokens[key]}` } : {}, payload });

async function flag(group: string, slug: string, name: string) {
  return (await req("admin", "POST", "/admin/flags", { group, slug, name })).json().flag.id as number;
}

describe("Flags", () => {
  it("admin cria, edita e exclui; lista é pública; slug repetido no grupo dá 409", async () => {
    const id = await flag("ano", "A", "Ano A");
    await flag("tempo", "advento", "Advento");
    expect((await req(null, "GET", "/flags")).json().flags.map((f: { slug: string }) => f.slug)).toEqual(["A", "advento"]);
    expect((await req("admin", "POST", "/admin/flags", { group: "ano", slug: "A", name: "Outro" })).statusCode).toBe(409);
    expect((await req("ana", "POST", "/admin/flags", { group: "ano", slug: "B", name: "Ano B" })).statusCode).toBe(403);
    expect((await req("admin", "PUT", `/admin/flags/${id}`, { group: "ano", slug: "A", name: "Ano A (Mateus)" })).json().flag.name).toBe("Ano A (Mateus)");
    expect((await req("admin", "DELETE", `/admin/flags/${id}`)).statusCode).toBe(204);
  });
});

describe("Cantos", () => {
  it("admin cria com várias flags, gera o slug e edita (PUT e PATCH)", async () => {
    const [a, b, adv] = [await flag("ano", "A", "Ano A"), await flag("ano", "B", "Ano B"), await flag("tempo", "advento", "Advento")];
    const res = await req("admin", "POST", "/admin/songs", {
      number: 7,
      title: "Ó Vem, Senhor, Não Tardes",
      key: "Em",
      lyrics: "Em        D\n**Ó vem, Senhor**",
      flagIds: [a, b, adv],
      media: { audiomack: "https://audiomack.com/embed/song/x" },
    });
    expect(res.statusCode).toBe(201);
    const song = res.json().song;
    expect(song).toMatchObject({ slug: "007-o-vem-senhor-nao-tardes", key: "Em", active: true });
    expect(song.flags.map((f: { slug: string }) => f.slug).sort()).toEqual(["A", "B", "advento"]);
    expect(song.media).toEqual({ audio: null, audiomack: "https://audiomack.com/embed/song/x", cifraPdf: null, partituraPdf: null });

    const patched = (await req("admin", "PATCH", `/admin/songs/${song.id}`, { title: "Ó vem, Senhor", flagIds: [a] })).json().song;
    // O slug não muda ao trocar o título: os links antigos continuam valendo.
    expect(patched).toMatchObject({ title: "Ó vem, Senhor", slug: song.slug, number: 7 });
    expect(patched.flags).toHaveLength(1);
    expect(patched.media.audiomack).toBe("https://audiomack.com/embed/song/x");

    const put = (await req("admin", "PUT", `/admin/songs/${song.id}`, { title: "Só título" })).json().song;
    expect(put).toMatchObject({ number: null, lyrics: "", flags: [] });
  });

  it("filtra por flags: OU dentro do mesmo grupo, E entre grupos", async () => {
    const [adv, nat, ent] = [await flag("tempo", "advento", "Advento"), await flag("tempo", "natal", "Natal"), await flag("momento", "entrada", "Entrada")];
    await req("admin", "POST", "/admin/songs", { title: "Advento de entrada", flagIds: [adv, ent] });
    await req("admin", "POST", "/admin/songs", { title: "Natal de entrada", flagIds: [nat, ent] });
    await req("admin", "POST", "/admin/songs", { title: "Advento sem momento", flagIds: [adv] });
    const titles = async (flags: number[]) =>
      (await req(null, "GET", `/songs?flags=${flags.join(",")}`)).json().songs.map((s: { title: string }) => s.title).sort();
    expect(await titles([adv])).toEqual(["Advento de entrada", "Advento sem momento"]);
    expect(await titles([adv, nat])).toHaveLength(3);
    expect(await titles([adv, nat, ent])).toEqual(["Advento de entrada", "Natal de entrada"]);
  });

  it("valida: flag inexistente, número repetido, músico não cria", async () => {
    expect((await req("admin", "POST", "/admin/songs", { title: "X", flagIds: [999] })).json().error.details.unknownFlagIds).toEqual([999]);
    await req("admin", "POST", "/admin/songs", { title: "Um", number: 1 });
    expect((await req("admin", "POST", "/admin/songs", { title: "Outro", number: 1 })).statusCode).toBe(409);
    expect((await req("ana", "POST", "/admin/songs", { title: "Y" })).statusCode).toBe(403);
  });

  it("canto oculto some do repertório público, mas o admin vê", async () => {
    const { id, slug } = (await req("admin", "POST", "/admin/songs", { title: "Oculto", active: false })).json().song;
    expect((await req(null, "GET", `/songs/${slug}`)).statusCode).toBe(404);
    expect((await req(null, "GET", "/songs")).json().total).toBe(0);
    expect((await req("admin", "GET", `/admin/songs/${id}`)).statusCode).toBe(200);
    expect((await req("admin", "GET", "/admin/songs")).json().total).toBe(1);
  });

  it("não exclui canto que está em missa (409); sem missa, exclui", async () => {
    const { id } = (await req("admin", "POST", "/admin/songs", { title: "Na missa" })).json().song;
    const mass = (await req("ana", "POST", "/masses", { slots: [{ id: "s", moment: "entrada", label: "Entrada", items: [{ songId: id }] }] })).json().mass;
    const blocked = await req("admin", "DELETE", `/admin/songs/${id}`);
    expect(blocked.json().error).toMatchObject({ code: "SONG_IN_USE", details: { masses: 1 } });
    await req("ana", "DELETE", `/masses/${mass.id}`);
    expect((await req("admin", "DELETE", `/admin/songs/${id}`)).statusCode).toBe(204);
  });

  it("upload: aceita PDF e MP3 pelos bytes, recusa o resto e troca o arquivo antigo", async () => {
    const { id } = (await req("admin", "POST", "/admin/songs", { title: "Com arquivos" })).json().song;
    const upload = (kind: string, data: Buffer, name: string) => {
      const boundary = "----psjb";
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        data,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      return app.inject({
        method: "PUT",
        url: `/api/admin/songs/${id}/files/${kind}`,
        headers: { authorization: `Bearer ${tokens.admin}`, "content-type": `multipart/form-data; boundary=${boundary}` },
        payload: body,
      });
    };
    const pdf = await upload("cifra-pdf", Buffer.from("%PDF-1.4 conteúdo"), "cifra.pdf");
    expect(pdf.json().song.media.cifraPdf).toMatch(/^mem:\/\/songs\/\d+\/cifra-pdf-.+\.pdf$/);
    const first = pdf.json().song.media.cifraPdf;
    await upload("cifra-pdf", Buffer.from("%PDF-1.7 outra"), "nova.pdf");
    expect(adapters.storage.files.has(first)).toBe(false); // o antigo foi apagado

    expect((await upload("audio", Buffer.from("ID3\x03\x00áudio"), "canto.mp3")).json().song.media.audio).toMatch(/\.mp3$/);
    expect((await upload("audio", Buffer.from("%PDF-1.4"), "falso.mp3")).statusCode).toBe(415);
    expect((await upload("partitura-pdf", Buffer.from("GIF89a"), "x.pdf")).statusCode).toBe(415);

    const removed = await req("admin", "DELETE", `/admin/songs/${id}/files/audio`);
    expect(removed.json().song.media.audio).toBeNull();
  });
});
