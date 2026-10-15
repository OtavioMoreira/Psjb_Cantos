import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { UserStatus } from "../../src/domain/user.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

const PASSWORD = "senha1234";
const addUser = async (email: string, status: UserStatus = "active") =>
  adapters.users.create({ name: "Ana Souza", email, passwordHash: await adapters.hasher.hash(PASSWORD), phone: null, movementId: null, status, roles: ["musico"] });
const forgot = (email: string) => app.inject({ method: "POST", url: "/api/auth/forgot", payload: { email } });
const reset = (token: string, password = "nova12345") => app.inject({ method: "POST", url: "/api/auth/reset", payload: { token, password } });
const login = (email: string, password: string) => app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });

beforeEach(async () => {
  const t = makeTestContainer({ APP_URL: "https://cantos.psjb.org.br/" });
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
});

describe("POST /api/auth/forgot", () => {
  it("envia o link de redefinição (1 h) para a conta ativa, com o endereço do site", async () => {
    await addUser("ana@x.com");
    const res = await forgot("  ANA@x.com ");
    expect(res.statusCode).toBe(202);
    const mail = adapters.email.last("ana@x.com")!;
    expect(mail.subject).toMatch(/Redefinir/);
    expect(mail.text).toContain("Olá, Ana!");
    expect(mail.text).toMatch(/https:\/\/cantos\.psjb\.org\.br\/redefinir-senha\?token=[\w-]{40,}/);
    const token = adapters.authTokens.rows[0];
    expect(Math.abs(token.expiresAt.getTime() - token.createdAt.getTime() - 60 * 60 * 1000)).toBeLessThan(1000);
    // Só o hash fica guardado.
    expect(mail.text).not.toContain(token.tokenHash);
  });

  it("responde igual para e-mail inexistente, conta pendente ou bloqueada, sem enviar nada", async () => {
    await addUser("pend@x.com", "pending");
    await addUser("bloq@x.com", "blocked");
    const bodies = [];
    for (const email of ["ninguem@x.com", "pend@x.com", "bloq@x.com"]) {
      const res = await forgot(email);
      expect(res.statusCode).toBe(202);
      bodies.push(res.body);
    }
    expect(new Set(bodies).size).toBe(1);
    expect(adapters.email.sent).toHaveLength(0);
  });

  it("não reenvia antes de 60 s (protege a cota de e-mails), mas responde igual", async () => {
    await addUser("ana@x.com");
    await forgot("ana@x.com");
    expect((await forgot("ana@x.com")).statusCode).toBe(202);
    expect(adapters.email.sent).toHaveLength(1);
  });

  it("falha no envio não aparece na resposta (não revela que a conta existe)", async () => {
    await addUser("ana@x.com");
    adapters.email.fail = true;
    expect((await forgot("ana@x.com")).statusCode).toBe(202);
  });

  it("valida o e-mail", async () => {
    expect((await forgot("nao-e-email")).statusCode).toBe(400);
  });
});

describe("POST /api/auth/reset", () => {
  it("troca a senha, derruba as sessões e o link não vale de novo", async () => {
    const user = await addUser("ana@x.com");
    await adapters.users.updatePassword(user.id, await adapters.hasher.hash(PASSWORD), true);
    const session = await login("ana@x.com", PASSWORD);
    const cookie = session.cookies.find((c) => c.name === "psjb_refresh")!.value;
    await forgot("ana@x.com");
    const token = adapters.email.token("ana@x.com")!;

    const res = await reset(token);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ email: "ana@x.com" });
    expect((await login("ana@x.com", PASSWORD)).statusCode).toBe(401);
    const ok = await login("ana@x.com", "nova12345");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.mustChangePassword).toBe(false);
    expect((await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: `psjb_refresh=${cookie}` } })).statusCode).toBe(401);

    const again = await reset(token, "outra12345");
    expect(again.statusCode).toBe(400);
    expect(again.json().error.code).toBe("INVALID_TOKEN");
  });

  it("só o último link pedido vale", async () => {
    await addUser("ana@x.com");
    await forgot("ana@x.com");
    const first = adapters.email.token()!;
    adapters.authTokens.rows[0].createdAt = new Date(Date.now() - 2 * 60 * 1000);
    await forgot("ana@x.com");
    const second = adapters.email.token()!;
    expect(second).not.toBe(first);
    expect((await reset(first)).statusCode).toBe(400);
    expect((await reset(second)).statusCode).toBe(200);
  });

  it("recusa link vencido, token inventado e senha fraca", async () => {
    await addUser("ana@x.com");
    await forgot("ana@x.com");
    const token = adapters.email.token()!;
    expect((await reset(token, "curta")).statusCode).toBe(400);
    expect((await reset("x".repeat(43))).json().error.code).toBe("INVALID_TOKEN");
    adapters.authTokens.rows[0].expiresAt = new Date(Date.now() - 1000);
    expect((await reset(token)).json().error.code).toBe("INVALID_TOKEN");
  });
});
