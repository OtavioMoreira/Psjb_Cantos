import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { UserStatus } from "../../src/domain/user.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

const PASSWORD = "senha1234";
const addUser = async (email: string, status: UserStatus = "active") =>
  adapters.users.create({ name: "Maria Silva", email, passwordHash: await adapters.hasher.hash(PASSWORD), phone: null, movementId: null, status, roles: ["musico"] });
const login = (email: string, opts: { password?: string; device?: string; remember?: boolean } = {}) =>
  app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: opts.password ?? PASSWORD, remember: opts.remember ?? true },
    headers: opts.device ? { cookie: `psjb_device=${opts.device}` } : {},
  });
const verify = (challengeId: string, code: string, trustDevice = false) =>
  app.inject({ method: "POST", url: "/api/auth/login/verify", payload: { challengeId, code, trustDevice } });
const codeFor = (email: string) => adapters.email.last(email)!.subject.match(/^(\d{6})/)![1];
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

beforeEach(async () => {
  const t = makeTestContainer({ LOGIN_2FA: "true" });
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
});

describe("Login em duas etapas", () => {
  it("senha certa → desafio (sem sessão) e código de 6 dígitos por e-mail; código certo → sessão", async () => {
    await addUser("maria@gmail.com");
    const res = await login("maria@gmail.com");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ twoFactor: true, emailHint: "m***@gmail.com", expiresIn: 600 });
    expect(body.accessToken).toBeUndefined();
    expect(res.cookies).toHaveLength(0);

    const code = codeFor("maria@gmail.com");
    expect(code).toMatch(/^\d{6}$/);
    // O código não fica guardado em texto.
    expect(JSON.stringify(adapters.authTokens.rows)).not.toContain(`"${code}"`);

    const ok = await verify(body.challengeId, code);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accessToken).toBeTruthy();
    expect(ok.json().user.email).toBe("maria@gmail.com");
    expect(ok.cookies.find((c) => c.name === "psjb_refresh")).toBeTruthy();
    expect(ok.cookies.find((c) => c.name === "psjb_device")).toBeUndefined();

    // Uso único.
    expect((await verify(body.challengeId, code)).json().error.code).toBe("INVALID_TOKEN");
  });

  it("senha errada, conta pendente ou bloqueada não geram código", async () => {
    await addUser("maria@x.com");
    await addUser("pend@x.com", "pending");
    await addUser("bloq@x.com", "blocked");
    expect((await login("maria@x.com", { password: "errada" })).statusCode).toBe(401);
    expect((await login("pend@x.com")).json().error.code).toBe("ACCOUNT_PENDING");
    expect((await login("bloq@x.com")).json().error.code).toBe("ACCOUNT_BLOCKED");
    expect(adapters.email.sent).toHaveLength(0);
  });

  it("código errado conta tentativa; na 5ª o desafio morre, e nem o código certo serve mais", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    const code = codeFor("maria@x.com");

    const first = await verify(challengeId, wrong(code));
    expect(first.statusCode).toBe(400);
    expect(first.json().error).toMatchObject({ code: "INVALID_CODE", details: { attemptsLeft: 4 } });
    for (let i = 0; i < 3; i++) await verify(challengeId, wrong(code));
    expect((await verify(challengeId, wrong(code))).json().error.code).toBe("INVALID_TOKEN");
    expect((await verify(challengeId, code)).json().error.code).toBe("INVALID_TOKEN");
  });

  it("código vencido (10 min) não vale; formato inválido é 400", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    expect((await verify(challengeId, "12ab56")).statusCode).toBe(400);
    adapters.authTokens.rows[0].expiresAt = new Date(Date.now() - 1000);
    expect((await verify(challengeId, codeFor("maria@x.com"))).json().error.code).toBe("INVALID_TOKEN");
  });

  it("conta bloqueada entre a senha e o código não entra", async () => {
    const u = await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    await adapters.users.updateStatus(u.id, "blocked", "teste");
    expect((await verify(challengeId, codeFor("maria@x.com"))).json().error.code).toBe("ACCOUNT_BLOCKED");
  });

  it("\"manter conectado\" desmarcado segue para a sessão aberta pelo código", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com", { remember: false })).json();
    const ok = await verify(challengeId, codeFor("maria@x.com"));
    expect(ok.cookies.find((c) => c.name === "psjb_refresh")?.expires).toBeUndefined();
  });

  it("falha no envio do código: 502 EMAIL_FAILED", async () => {
    await addUser("maria@x.com");
    adapters.email.fail = true;
    expect((await login("maria@x.com")).json().error.code).toBe("EMAIL_FAILED");
  });
});

describe("Confiar neste aparelho", () => {
  it("grava o cookie de 30 dias e, com ele, o próximo login dispensa o código", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    const ok = await verify(challengeId, codeFor("maria@x.com"), true);
    const device = ok.cookies.find((c) => c.name === "psjb_device")!;
    expect(device).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api/auth" });
    const days = (new Date(device.expires!).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);

    const sent = adapters.email.sent.length;
    const again = await login("maria@x.com", { device: device.value });
    expect(again.json().accessToken).toBeTruthy();
    expect(adapters.email.sent).toHaveLength(sent);
  });

  it("o cookie de uma pessoa não dispensa o código de outra; cookie inventado também não", async () => {
    await addUser("maria@x.com");
    await addUser("joao@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    const device = (await verify(challengeId, codeFor("maria@x.com"), true)).cookies.find((c) => c.name === "psjb_device")!.value;
    expect((await login("joao@x.com", { device })).json().twoFactor).toBe(true);
    expect((await login("maria@x.com", { device: "inventado" })).json().twoFactor).toBe(true);
  });

  it("trocar a senha tira a confiança dos aparelhos", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    const ok = await verify(challengeId, codeFor("maria@x.com"), true);
    const device = ok.cookies.find((c) => c.name === "psjb_device")!.value;
    await app.inject({
      method: "POST",
      url: "/api/auth/password",
      headers: { authorization: `Bearer ${ok.json().accessToken}` },
      payload: { currentPassword: PASSWORD, newPassword: "nova12345" },
    });
    expect((await login("maria@x.com", { password: "nova12345", device })).json().twoFactor).toBe(true);
  });
});

describe("Reenviar o código", () => {
  it("só depois de 60 s; o código novo substitui o anterior", async () => {
    await addUser("maria@x.com");
    const { challengeId } = (await login("maria@x.com")).json();
    const oldCode = codeFor("maria@x.com");
    const resend = (id: string) => app.inject({ method: "POST", url: "/api/auth/login/resend", payload: { challengeId: id } });

    const early = await resend(challengeId);
    expect(early.statusCode).toBe(429);
    expect(early.json().error.code).toBe("TOO_SOON");

    adapters.authTokens.rows[0].createdAt = new Date(Date.now() - 61_000);
    const res = await resend(challengeId);
    expect(res.statusCode).toBe(200);
    const next = res.json();
    expect(next).toMatchObject({ twoFactor: true, emailHint: "m***@x.com" });
    expect(next.challengeId).not.toBe(challengeId);

    expect((await verify(challengeId, oldCode)).json().error.code).toBe("INVALID_TOKEN");
    expect((await verify(next.challengeId, codeFor("maria@x.com"))).statusCode).toBe(200);
  });
});
