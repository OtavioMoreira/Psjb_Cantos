import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { SignJWT } from "jose";
import { afterAll, describe, expect, it, vi } from "vitest";
import { sniffSongFile } from "../../src/actions/songs/SongActions.js";
import { ConsoleEmailSender } from "../../src/services/ConsoleEmailSender.js";
import { Argon2PasswordHasher } from "../../src/services/Argon2PasswordHasher.js";
import { JoseTokenService } from "../../src/services/JoseTokenService.js";
import { LocalDiskStorage } from "../../src/services/LocalDiskStorage.js";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres!!";
const tokens = new JoseTokenService(SECRET, 900);
const key = new TextEncoder().encode(SECRET);
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

describe("JoseTokenService (JWT)", () => {
  it("assina e confere: devolve o id e os papéis", async () => {
    const { token, expiresIn } = await tokens.signAccessToken({ userId: "u1", roles: ["admin"] });
    expect(expiresIn).toBe(900);
    expect(await tokens.verifyAccessToken(token)).toEqual({ userId: "u1", roles: ["admin"] });
  });

  it("recusa token adulterado (papel trocado no payload)", async () => {
    const { token } = await tokens.signAccessToken({ userId: "u1", roles: ["musico"] });
    const [h, , s] = token.split(".");
    const forged = `${h}.${b64({ sub: "u1", roles: ["admin"], iss: "psjb-cantos-api", aud: "psjb-cantos-web", exp: 9999999999 })}.${s}`;
    await expect(tokens.verifyAccessToken(forged)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it('recusa "alg: none" (token sem assinatura)', async () => {
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "u1", roles: ["admin"], iss: "psjb-cantos-api", aud: "psjb-cantos-web", exp: 9999999999 })}.`;
    await expect(tokens.verifyAccessToken(none)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("recusa token assinado com outro segredo", async () => {
    const other = new JoseTokenService("outro-segredo-com-mais-de-32-caracteres-aqui", 900);
    const { token } = await other.signAccessToken({ userId: "u1", roles: ["admin"] });
    await expect(tokens.verifyAccessToken(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("recusa token vencido, de outro emissor/público ou sem sub", async () => {
    const base = () => new SignJWT({ roles: ["admin"] }).setProtectedHeader({ alg: "HS256" });
    const expired = await base().setSubject("u1").setIssuer("psjb-cantos-api").setAudience("psjb-cantos-web").setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(key);
    const wrongAud = await base().setSubject("u1").setIssuer("psjb-cantos-api").setAudience("outro-site").setExpirationTime("5m").sign(key);
    const wrongIss = await base().setSubject("u1").setIssuer("outra-api").setAudience("psjb-cantos-web").setExpirationTime("5m").sign(key);
    const noSub = await base().setIssuer("psjb-cantos-api").setAudience("psjb-cantos-web").setExpirationTime("5m").sign(key);
    for (const t of [expired, wrongAud, wrongIss, noSub, "lixo", ""]) await expect(tokens.verifyAccessToken(t)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("ignora papéis desconhecidos no token", async () => {
    const t = await new SignJWT({ roles: ["superuser", "admin", 42] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u1")
      .setIssuer("psjb-cantos-api")
      .setAudience("psjb-cantos-web")
      .setExpirationTime("5m")
      .sign(key);
    expect((await tokens.verifyAccessToken(t)).roles).toEqual(["admin"]);
  });

  it("refresh token: 256 bits aleatórios, e o banco só guarda o SHA-256", () => {
    const a = tokens.generateRefreshToken();
    const b = tokens.generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(Buffer.from(a.token, "base64url")).toHaveLength(32);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).not.toContain(a.token);
    expect(tokens.hashRefreshToken(a.token)).toBe(a.hash);
  });
});

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();
  it("gera argon2id com salt (dois hashes da mesma senha são diferentes) e confere", async () => {
    const [h1, h2] = [await hasher.hash("senha1234"), await hasher.hash("senha1234")];
    expect(h1).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain("senha1234");
    expect(await hasher.verify(h1, "senha1234")).toBe(true);
    expect(await hasher.verify(h1, "Senha1234")).toBe(false);
  });
  it("hash em formato inválido (ex.: MD5 do site antigo) conta como senha errada, sem erro", async () => {
    expect(await hasher.verify("e10adc3949ba59abbe56e057f20f883e", "123456")).toBe(false);
    expect(await hasher.verify("", "")).toBe(false);
  });
});

describe("LocalDiskStorage", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "psjb-uploads-"));
  const storage = new LocalDiskStorage(root, "http://api.local");
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("grava e devolve a URL pública; apaga pela URL", async () => {
    const url = await storage.put("users/u1/foto.png", Buffer.from("png"), "image/png");
    expect(url).toBe("http://api.local/uploads/users/u1/foto.png");
    expect(await readFile(path.join(root, "users/u1/foto.png"), "utf8")).toBe("png");
    await storage.delete(url);
    await expect(readFile(path.join(root, "users/u1/foto.png"))).rejects.toThrow();
  });

  it("bloqueia path traversal (../) na gravação e na exclusão", async () => {
    await expect(storage.put("../../etc/passwd", Buffer.from("x"), "text/plain")).rejects.toThrow(/fora de uploads/);
    await expect(storage.delete("http://api.local/uploads/../../../etc/passwd")).rejects.toThrow(/fora de uploads/);
  });

  it("URL de outro lugar (ex.: site antigo) é ignorada na exclusão", async () => {
    await expect(storage.delete("https://cantos.psjb.org.br/uploads/audios/39/a.mp3")).resolves.toBeUndefined();
  });
});

describe("Identificação de arquivos pelos bytes (o nome e o Content-Type não valem)", () => {
  it("PDF só nos tipos de PDF; áudio MP3 (ID3 ou frame), M4A e OGG", () => {
    expect(sniffSongFile("cifra-pdf", Buffer.from("%PDF-1.7"))?.contentType).toBe("application/pdf");
    expect(sniffSongFile("partitura-pdf", Buffer.from("%PDF-1.4"))?.ext).toBe("pdf");
    expect(sniffSongFile("audio", Buffer.from("%PDF-1.4"))).toBeNull();
    expect(sniffSongFile("cifra-pdf", Buffer.from("ID3"))).toBeNull();
    expect(sniffSongFile("audio", Buffer.from("ID3\x03"))?.ext).toBe("mp3");
    expect(sniffSongFile("audio", Buffer.from([0xff, 0xfb, 0x90, 0x00]))?.ext).toBe("mp3");
    expect(sniffSongFile("audio", Buffer.from("\0\0\0\x20ftypM4A "))?.ext).toBe("m4a");
    expect(sniffSongFile("audio", Buffer.from("OggS\0"))?.ext).toBe("ogg");
    expect(sniffSongFile("audio", Buffer.from("MZ\x90\0"))).toBeNull(); // executável
  });
});

describe("ConsoleEmailSender", () => {
  const message = { to: "ana@x.com", subject: "Seu código de acesso", text: "Código: 123456", html: "<p>123456</p>" };

  it("em desenvolvimento mostra o texto (link ou código) no terminal", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleEmailSender({ showContent: true }).send(message);
    expect(log.mock.calls[0][0]).toContain("123456");
    log.mockRestore();
  });

  it("em produção (e-mail travado) registra só destinatário e assunto, nunca o código", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await new ConsoleEmailSender({ showContent: false }).send(message);
    expect(log.mock.calls[0][0]).toContain("ana@x.com");
    expect(log.mock.calls[0][0]).not.toContain("123456");
    log.mockRestore();
  });
});

describe("CaptchaVerifier (Turnstile / reCAPTCHA)", async () => {
  const { CaptchaVerifier } = await import("../../src/services/CaptchaVerifier.js");
  const reply = (json: object, status = 200) => (async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

  it("manda segredo, token e IP para o provedor certo e só aceita success: true", async () => {
    const calls: { url: string; body: string }[] = [];
    const spy = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response(JSON.stringify({ success: true }));
    }) as unknown as typeof fetch;
    expect(await new CaptchaVerifier("segredo-123", "turnstile", spy).verify("tok", "1.2.3.4")).toBe(true);
    expect(calls[0].url).toContain("challenges.cloudflare.com");
    expect(calls[0].body).toBe("secret=segredo-123&response=tok&remoteip=1.2.3.4");
    await new CaptchaVerifier("segredo-123", "recaptcha", spy).verify("tok", null);
    expect(calls[1].url).toContain("google.com/recaptcha");
    expect(calls[1].body).not.toContain("remoteip");

    expect(await new CaptchaVerifier("s", "turnstile", reply({ success: false })).verify("t", null)).toBe(false);
  });

  it("reCAPTCHA v3 com nota baixa, erro HTTP ou de rede: não verificado", async () => {
    expect(await new CaptchaVerifier("s", "recaptcha", reply({ success: true, score: 0.2 })).verify("t", null)).toBe(false);
    expect(await new CaptchaVerifier("s", "recaptcha", reply({ success: true, score: 0.9 })).verify("t", null)).toBe(true);
    expect(await new CaptchaVerifier("s", "turnstile", reply({}, 500)).verify("t", null)).toBe(false);
    const down = (async () => {
      throw new Error("sem rede");
    }) as unknown as typeof fetch;
    expect(await new CaptchaVerifier("s", "turnstile", down).verify("t", null)).toBe(false);
  });
});
