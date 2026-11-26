import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/buildApp.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

const post = (url: string, payload: object) => app.inject({ method: "POST", url: `/api${url}`, payload });
const NEW_USER = { name: "Maria Teste", email: "maria@x.com", password: "senha1234", phone: null, movementIds: [] };
const login = (password: string, captchaToken?: string) => post("/auth/login", { email: "ana@x.com", password, captchaToken });

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  adapters.captcha.enabled = true;
  app = await buildApp({ container: t.container, logger: false });
  await adapters.users.create({ name: "Ana", email: "ana@x.com", passwordHash: await adapters.hasher.hash("senha1234"), phone: null, movementIds: [], status: "active", roles: ["musico"] });
});

describe("Desafio \"não sou um robô\" (reCAPTCHA/Turnstile) no servidor", () => {
  it("cadastro: sem token ou com token recusado → 400 CAPTCHA_REQUIRED; com token válido, cria", async () => {
    expect((await post("/users", NEW_USER)).json().error).toMatchObject({ code: "CAPTCHA_REQUIRED", details: { captcha: true } });
    expect((await post("/users", { ...NEW_USER, captchaToken: "robo" })).statusCode).toBe(400);
    expect(await adapters.users.emailExists("maria@x.com")).toBe(false);
    expect((await post("/users", { ...NEW_USER, captchaToken: "humano" })).statusCode).toBe(201);
  });

  it("recuperação de senha: exige o desafio antes de procurar a conta (mesma resposta exista ou não)", async () => {
    expect((await post("/auth/forgot", { email: "ninguem@x.com" })).json().error.code).toBe("CAPTCHA_REQUIRED");
    expect((await post("/auth/forgot", { email: "ana@x.com" })).json().error.code).toBe("CAPTCHA_REQUIRED");
    expect(adapters.email.sent).toHaveLength(0);
    expect((await post("/auth/forgot", { email: "ana@x.com", captchaToken: "humano" })).statusCode).toBe(202);
    expect(adapters.email.last("ana@x.com")).toBeDefined();
  });

  it("login: livre até 3 senhas erradas; a 3ª já avisa; depois só com o desafio; acertar zera", async () => {
    expect((await login("errada1")).json().error).toEqual({ code: "INVALID_CREDENTIALS", message: "E-mail ou senha não conferem." });
    await login("errada2");
    // A 3ª erra e avisa o front para mostrar o desafio.
    expect((await login("errada3")).json().error.details).toEqual({ captcha: true });

    // Agora, nem a senha certa entra sem o desafio.
    expect((await login("senha1234")).json().error.code).toBe("CAPTCHA_REQUIRED");
    expect((await login("senha1234", "robo")).json().error.code).toBe("CAPTCHA_REQUIRED");
    expect((await login("senha1234", "humano")).statusCode).toBe(200);

    // Acertou: o contador zera e o desafio deixa de ser pedido.
    expect((await login("senha1234")).statusCode).toBe(200);
  });

  it("e-mail que não existe conta do mesmo jeito (não revela a conta)", async () => {
    const ghost = () => post("/auth/login", { email: "fantasma@x.com", password: "x" });
    await ghost();
    await ghost();
    expect((await ghost()).json().error.details).toEqual({ captcha: true });
    expect((await ghost()).json().error.code).toBe("CAPTCHA_REQUIRED");
  });

  it("com o desafio desligado (sem CAPTCHA_SECRET), nada muda", async () => {
    adapters.captcha.enabled = false;
    expect((await post("/users", NEW_USER)).statusCode).toBe(201);
    for (let i = 0; i < 5; i++) await login("errada");
    expect((await login("senha1234")).statusCode).toBe(200);
    expect(adapters.captcha.checked).toEqual([]);
  });
});
