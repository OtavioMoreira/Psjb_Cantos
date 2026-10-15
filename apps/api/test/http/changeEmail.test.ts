import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
let token: string;

const PASSWORD = "senha1234";
const addUser = async (email: string) =>
  adapters.users.create({ name: "Ana Souza", email, passwordHash: await adapters.hasher.hash(PASSWORD), phone: null, movementId: null, status: "active", roles: ["musico"] });
const request = (payload: object) => app.inject({ method: "POST", url: "/api/me/email", headers: { authorization: `Bearer ${token}` }, payload });
const confirm = (t: string) => app.inject({ method: "POST", url: "/api/auth/confirm-email", payload: { token: t } });

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  await addUser("ana@x.com");
  token = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "ana@x.com", password: PASSWORD } })).json().accessToken;
});

describe("Troca do próprio e-mail", () => {
  it("manda o link (24 h) para o novo endereço; o antigo vale até confirmar; depois, avisa o antigo", async () => {
    const res = await request({ email: "Ana.Nova@x.com", password: PASSWORD });
    expect(res.statusCode).toBe(202);
    const mail = adapters.email.last("ana.nova@x.com")!;
    expect(mail.text).toMatch(/confirmar-email\?token=/);
    const t = adapters.authTokens.rows[0];
    expect(t.data).toEqual({ newEmail: "ana.nova@x.com" });
    expect(Math.abs(t.expiresAt.getTime() - t.createdAt.getTime() - 24 * 60 * 60 * 1000)).toBeLessThan(1000);
    expect(adapters.users.rows[0].email).toBe("ana@x.com");

    const ok = await confirm(adapters.email.token("ana.nova@x.com")!);
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ email: "ana.nova@x.com" });
    expect(adapters.users.rows[0].email).toBe("ana.nova@x.com");
    expect(adapters.email.last("ana@x.com")?.text).toContain("foi trocado para ana.nova@x.com");

    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "ana.nova@x.com", password: PASSWORD } });
    expect(login.statusCode).toBe(200);
  });

  it("exige a senha e recusa o mesmo e-mail ou um de outra conta", async () => {
    await addUser("outra@x.com");
    expect((await request({ email: "nova@x.com", password: "errada" })).json().error.details.fields).toEqual({ password: "Senha incorreta." });
    expect((await request({ email: "ana@x.com", password: PASSWORD })).json().error.details.fields).toEqual({ email: "Este já é o seu e-mail." });
    expect((await request({ email: "outra@x.com", password: PASSWORD })).json().error.details.fields).toEqual({ email: "Já existe uma conta com este e-mail." });
    expect(adapters.email.sent).toHaveLength(0);
  });

  it("não reenvia antes de 60 s (429 TOO_SOON) e só o último link vale", async () => {
    await request({ email: "um@x.com", password: PASSWORD });
    const first = adapters.email.token()!;
    expect((await request({ email: "dois@x.com", password: PASSWORD })).json().error.code).toBe("TOO_SOON");
    adapters.authTokens.rows[0].createdAt = new Date(Date.now() - 2 * 60 * 1000);
    await request({ email: "dois@x.com", password: PASSWORD });
    expect((await confirm(first)).json().error.code).toBe("INVALID_TOKEN");
    expect((await confirm(adapters.email.token("dois@x.com")!)).json()).toEqual({ email: "dois@x.com" });
  });

  it("se o endereço foi ocupado entre o pedido e a confirmação, recusa com EMAIL_TAKEN", async () => {
    await request({ email: "nova@x.com", password: PASSWORD });
    await addUser("nova@x.com");
    const res = await confirm(adapters.email.token("nova@x.com")!);
    expect(res.statusCode).toBe(409);
    expect(adapters.users.rows[0].email).toBe("ana@x.com");
  });

  it("falha no envio: 502 e o link não fica valendo", async () => {
    adapters.email.fail = true;
    expect((await request({ email: "nova@x.com", password: PASSWORD })).json().error.code).toBe("EMAIL_FAILED");
    expect(adapters.authTokens.rows.every((r) => r.usedAt)).toBe(true);
  });

  it("o link é de uso único e não serve para redefinir senha", async () => {
    await request({ email: "nova@x.com", password: PASSWORD });
    const t = adapters.email.token()!;
    expect((await app.inject({ method: "POST", url: "/api/auth/reset", payload: { token: t, password: "outra12345" } })).statusCode).toBe(400);
    expect((await confirm(t)).statusCode).toBe(200);
    expect((await confirm(t)).statusCode).toBe(400);
  });
});
