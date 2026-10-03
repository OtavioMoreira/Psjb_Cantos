import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

const ADMIN = { email: "superadmin@psjb.org.br", password: "123456" };
const NEW_USER = { name: "Maria Teste", email: "Maria@Exemplo.com ", password: "senha1234", phone: "(31) 99999-0000" };

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  const admin = await adapters.users.create({
    name: "Superadmin",
    email: ADMIN.email,
    passwordHash: await adapters.hasher.hash(ADMIN.password),
    phone: null,
    movementId: null,
    status: "active",
    roles: ["admin", "musico"],
  });
  expect(admin.id).toBeTruthy();
});

const login = (body: object) => app.inject({ method: "POST", url: "/api/auth/login", payload: body });
const refreshCookie = (res: { cookies: { name: string; value: string }[] }) => res.cookies.find((c) => c.name === "psjb_refresh")?.value;

describe("POST /api/users (cadastro)", () => {
  it("cria a conta pendente, com papel músico e e-mail normalizado", async () => {
    const res = await app.inject({ method: "POST", url: "/api/users", payload: NEW_USER });
    expect(res.statusCode).toBe(201);
    const { user } = res.json();
    expect(user).toMatchObject({ email: "maria@exemplo.com", status: "pending", roles: ["musico"], phone: "(31) 99999-0000" });
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("recusa e-mail repetido (409) e dados inválidos (400 com os campos)", async () => {
    await app.inject({ method: "POST", url: "/api/users", payload: NEW_USER });
    const dup = await app.inject({ method: "POST", url: "/api/users", payload: { ...NEW_USER, email: "maria@exemplo.com" } });
    expect(dup.statusCode).toBe(409);
    const bad = await app.inject({ method: "POST", url: "/api/users", payload: { name: "Ma", email: "x", password: "abcdefgh" } });
    expect(bad.statusCode).toBe(400);
    expect(Object.keys(bad.json().error.details.fields)).toEqual(["name", "email", "password"]);
  });
});

describe("POST /api/auth/login", () => {
  it("entra com e-mail em qualquer caixa e devolve access token + cookie httpOnly", async () => {
    const res = await login({ email: " SuperAdmin@PSJB.org.br", password: "123456" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ expiresIn: 900, user: { roles: ["admin", "musico"] } });
    const cookie = res.cookies.find((c) => c.name === "psjb_refresh");
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/api/auth" });
  });

  it("mesma mensagem para e-mail inexistente e senha errada", async () => {
    const a = await login({ email: ADMIN.email, password: "errada" });
    const b = await login({ email: "ninguem@psjb.org.br", password: "errada" });
    expect(a.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  it("conta pendente recebe 403 ACCOUNT_PENDING; bloqueada, 403 ACCOUNT_BLOCKED com o motivo", async () => {
    await app.inject({ method: "POST", url: "/api/users", payload: NEW_USER });
    const pending = await login({ email: "maria@exemplo.com", password: NEW_USER.password });
    expect(pending.statusCode).toBe(403);
    expect(pending.json().error.code).toBe("ACCOUNT_PENDING");

    const maria = adapters.users.rows.find((u) => u.email === "maria@exemplo.com")!;
    await adapters.users.updateStatus(maria.id, "blocked", "Conta duplicada");
    const blocked = await login({ email: "maria@exemplo.com", password: NEW_USER.password });
    expect(blocked.json().error).toMatchObject({ code: "ACCOUNT_BLOCKED", details: { reason: "Conta duplicada" } });
  });
});

describe("GET /api/me", () => {
  it("exige token e devolve os dados da pessoa", async () => {
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    const { accessToken } = (await login(ADMIN)).json();
    const me = await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${accessToken}` } });
    expect(me.json().user).toMatchObject({ email: ADMIN.email, status: "active" });
  });

  it("token adulterado é recusado", async () => {
    const { accessToken } = (await login(ADMIN)).json();
    const res = await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${accessToken}x` } });
    expect(res.statusCode).toBe(401);
  });
});

describe("Papéis: rotas /api/admin", () => {
  it("admin lista e ativa; músico recebe 403; sem token, 401", async () => {
    const created = (await app.inject({ method: "POST", url: "/api/users", payload: NEW_USER })).json().user;
    const { accessToken: adminToken } = (await login(ADMIN)).json();

    expect((await app.inject({ method: "GET", url: "/api/admin/users" })).statusCode).toBe(401);

    const list = await app.inject({ method: "GET", url: "/api/admin/users?status=pending", headers: { authorization: `Bearer ${adminToken}` } });
    expect(list.json().users.map((u: { id: string }) => u.id)).toEqual([created.id]);

    const act = await app.inject({ method: "PATCH", url: `/api/admin/users/${created.id}/activate`, headers: { authorization: `Bearer ${adminToken}` } });
    expect(act.json().user.status).toBe("active");

    const { accessToken: musicoToken } = (await login({ email: "maria@exemplo.com", password: NEW_USER.password })).json();
    const forbidden = await app.inject({ method: "GET", url: "/api/admin/users", headers: { authorization: `Bearer ${musicoToken}` } });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe("Refresh token", () => {
  it("rotaciona; reusar o token antigo derruba a família inteira", async () => {
    const first = refreshCookie(await login(ADMIN))!;
    const r1 = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: first } });
    expect(r1.statusCode).toBe(200);
    const second = refreshCookie(r1)!;
    expect(second).not.toBe(first);

    const reuse = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: first } });
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: second } });
    expect(afterReuse.statusCode).toBe(401);
  });

  it("logout revoga a sessão", async () => {
    const token = refreshCookie(await login(ADMIN))!;
    expect((await app.inject({ method: "POST", url: "/api/auth/logout", cookies: { psjb_refresh: token } })).statusCode).toBe(204);
    expect((await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: token } })).statusCode).toBe(401);
  });
});
