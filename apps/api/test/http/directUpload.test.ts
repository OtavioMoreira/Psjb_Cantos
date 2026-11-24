import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/buildApp.js";
import type { DirectUploadStorage } from "../../src/interfaces/index.js";
import { makeTestContainer } from "../support/inMemory.js";

/** Blob falso com envio direto: o "navegador" grava em `files` com o caminho do token. */
class FakeBlob implements DirectUploadStorage {
  files = new Map<string, Buffer>();
  tokens: { path: string; contentTypes: string[]; maxBytes: number }[] = [];
  deleted: string[] = [];
  readonly host = "https://loja.public.blob.vercel-storage.com/";
  async put(path: string, data: Buffer) {
    this.files.set(path, data);
    return this.host + path;
  }
  async delete(url: string) {
    this.deleted.push(url);
    this.files.delete(url.replace(this.host, ""));
  }
  async createUploadToken(path: string, opts: { contentTypes: string[]; maxBytes: number }) {
    this.tokens.push({ path, ...opts });
    return `token-de-${path}`;
  }
  pathOf(url: string) {
    return url.startsWith(this.host) ? url.slice(this.host.length) : null;
  }
  async inspect(url: string) {
    const f = this.files.get(url.replace(this.host, ""));
    if (!f) throw new Error("não existe");
    return { size: f.length, firstBytes: f.subarray(0, 64) };
  }
}

let app: FastifyInstance;
let blob: FakeBlob;
let token: string;
let songId: number;

const req = (method: "POST" | "PUT", url: string, payload: object) =>
  app.inject({ method, url: `/api/admin/songs/${songId}/files${url}`, headers: { authorization: `Bearer ${token}` }, payload });

beforeEach(async () => {
  const t = makeTestContainer();
  blob = new FakeBlob();
  (t.adapters as { storage: unknown }).storage = blob;
  const { buildContainer } = await import("../../src/container.js");
  const { loadEnv } = await import("../../src/config/env.js");
  app = await buildApp({ container: buildContainer(loadEnv({ NODE_ENV: "test" }), t.adapters), logger: false });
  await t.adapters.users.create({ name: "Admin", email: "a@x.com", passwordHash: await t.adapters.hasher.hash("senha1234"), phone: null, movementId: null, status: "active", roles: ["admin"] });
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@x.com", password: "senha1234" } })).json().accessToken;
  songId = (await app.inject({ method: "POST", url: "/api/admin/songs", headers: { authorization: `Bearer ${token}` }, payload: { title: "Glória" } })).json().song.id;
});

describe("Envio direto ao Blob (arquivos acima de 4 MB)", () => {
  it("token preso ao caminho deste canto e tipo; depois confere os bytes e liga ao canto", async () => {
    const ticket = (await req("POST", "/audio/upload", { contentType: "audio/mpeg", size: 9_000_000 })).json();
    expect(ticket).toMatchObject({ mode: "direct", maxBytes: 25 * 1024 * 1024 });
    expect(ticket.pathname).toMatch(new RegExp(`^songs/${songId}/audio-[0-9a-f-]{36}\\.mp3$`));
    expect(blob.tokens[0]).toMatchObject({ path: ticket.pathname, contentTypes: ["audio/mpeg"] });

    // O navegador manda direto ao Blob...
    const url = await blob.put(ticket.pathname, Buffer.concat([Buffer.from("ID3\x03"), Buffer.alloc(9_000_000)]));
    // ...e a API liga ao canto.
    const res = await req("PUT", "/audio/blob", { url });
    expect(res.statusCode).toBe(200);
    expect(res.json().song.media.audio).toBe(url);

    // Trocar o arquivo apaga o anterior.
    const t2 = (await req("POST", "/audio/upload", { contentType: "audio/mpeg", size: 5_000_000 })).json();
    const url2 = await blob.put(t2.pathname, Buffer.from("ID3\x04resto"));
    await req("PUT", "/audio/blob", { url: url2 });
    expect(blob.deleted).toEqual([url]);
  });

  it("recusa tipo errado para o campo, arquivo grande demais e canto inexistente", async () => {
    expect((await req("POST", "/cifra-pdf/upload", { contentType: "audio/mpeg", size: 10 })).statusCode).toBe(415);
    expect((await req("POST", "/audio/upload", { contentType: "application/pdf", size: 10 })).statusCode).toBe(415);
    expect((await req("POST", "/audio/upload", { contentType: "audio/mpeg", size: 26 * 1024 * 1024 })).statusCode).toBe(415);
    expect((await req("POST", "/audio/upload", { contentType: "video/mp4", size: 10 })).statusCode).toBe(400);
    songId = 999;
    expect((await req("POST", "/audio/upload", { contentType: "audio/mpeg", size: 10 })).statusCode).toBe(404);
  });

  it("URL de outro lugar, de outro canto ou de outro tipo não é aceita", async () => {
    expect((await req("PUT", "/audio/blob", { url: "https://evil.example.com/songs/1/audio-x.mp3" })).statusCode).toBe(400);
    const other = await blob.put(`songs/${songId + 1}/audio-00000000-0000-0000-0000-000000000000.mp3`, Buffer.from("ID3x"));
    expect((await req("PUT", "/audio/blob", { url: other })).statusCode).toBe(400);
    const pdf = await blob.put(`songs/${songId}/cifra-pdf-00000000-0000-0000-0000-000000000000.pdf`, Buffer.from("%PDF-1.4"));
    expect((await req("PUT", "/audio/blob", { url: pdf })).statusCode).toBe(400);
  });

  it("bytes que não são do tipo declarado: apaga do Blob e responde 415", async () => {
    const t = (await req("POST", "/audio/upload", { contentType: "audio/mpeg", size: 100 })).json();
    const fake = await blob.put(t.pathname, Buffer.from("<html>não é áudio</html>"));
    expect((await req("PUT", "/audio/blob", { url: fake })).statusCode).toBe(415);
    expect(blob.deleted).toEqual([fake]);
  });

  it("sem Blob (disco local), o ticket manda usar o envio de sempre", async () => {
    const t = makeTestContainer();
    const local = await buildApp({ container: t.container, logger: false });
    await t.adapters.users.create({ name: "Admin", email: "b@x.com", passwordHash: await t.adapters.hasher.hash("senha1234"), phone: null, movementId: null, status: "active", roles: ["admin"] });
    const tk = (await local.inject({ method: "POST", url: "/api/auth/login", payload: { email: "b@x.com", password: "senha1234" } })).json().accessToken;
    const h = { authorization: `Bearer ${tk}` };
    const id = (await local.inject({ method: "POST", url: "/api/admin/songs", headers: h, payload: { title: "X" } })).json().song.id;
    const res = await local.inject({ method: "POST", url: `/api/admin/songs/${id}/files/audio/upload`, headers: h, payload: { contentType: "audio/mpeg", size: 10 } });
    expect(res.json()).toEqual({ mode: "server", maxBytes: 4 * 1024 * 1024 });
  });
});
