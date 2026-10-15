import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { Role, UserStatus } from "../../src/domain/user.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
let adminToken: string;

const PASSWORD = "senha1234";
const addUser = async (email: string, status: UserStatus = "active", roles: Role[] = ["musico"], name = "Pessoa Teste") =>
  adapters.users.create({ name, email, passwordHash: await adapters.hasher.hash(PASSWORD), phone: null, movementId: null, status, roles });
const login = (email: string, password = PASSWORD) => app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
const as = () => ({ authorization: `Bearer ${adminToken}` });
const invite = (payload: object) => app.inject({ method: "POST", url: "/api/admin/users/invite", headers: as(), payload });

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  await addUser("admin@x.com", "active", ["admin", "musico"], "Padre João");
  adminToken = (await login("admin@x.com")).json().accessToken;
});

describe("Convite (POST /api/admin/users/invite)", () => {
  it("cria a conta pendente, manda o link de 7 dias e, ao criar a senha, a conta fica ativa", async () => {
    const res = await invite({ name: "Bia Lima", email: "Bia@X.com", roles: ["musico"] });
    expect(res.statusCode).toBe(201);
    expect(res.json().user).toMatchObject({ email: "bia@x.com", status: "pending", roles: ["musico"] });

    const mail = adapters.email.last("bia@x.com")!;
    expect(mail.subject).toMatch(/convidado/);
    expect(mail.text).toContain("Padre João convidou você");
    expect(mail.text).toMatch(/redefinir-senha\?token=[\w-]+&convite=1/);
    const t = adapters.authTokens.rows.find((r) => r.purpose === "invite")!;
    expect(Math.abs(t.expiresAt.getTime() - t.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000)).toBeLessThan(1000);

    // Antes de usar o link, não há senha que funcione.
    expect((await login("bia@x.com")).statusCode).toBe(401);

    const reset = await app.inject({ method: "POST", url: "/api/auth/reset", payload: { token: adapters.email.token("bia@x.com"), password: "minha12345" } });
    expect(reset.statusCode).toBe(200);
    const ok = await login("bia@x.com", "minha12345");
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.status).toBe("active");
  });

  it("papel padrão é músico; e-mail repetido é 409; valida os campos", async () => {
    expect((await invite({ name: "Caio Reis", email: "caio@x.com" })).json().user.roles).toEqual(["musico"]);
    expect((await invite({ name: "Outro", email: "caio@x.com" })).json().error.code).toBe("EMAIL_TAKEN");
    expect((await invite({ name: "Ab", email: "x" })).statusCode).toBe(400);
    expect((await invite({ name: "Dani Souza", email: "dani@x.com", status: "active" })).statusCode).toBe(400);
  });

  it("se o e-mail não sai, o admin fica sabendo (502) e pode reenviar o convite", async () => {
    adapters.email.fail = true;
    const res = await invite({ name: "Bia Lima", email: "bia@x.com" });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("EMAIL_FAILED");
    const id = adapters.users.rows.find((u) => u.email === "bia@x.com")!.id;

    adapters.email.fail = false;
    const resend = await app.inject({ method: "POST", url: `/api/admin/users/${id}/invite`, headers: as() });
    expect(resend.statusCode).toBe(202);
    expect(adapters.email.last("bia@x.com")?.subject).toMatch(/convidado/);
  });

  it("reenviar só vale para conta pendente, e o link anterior deixa de valer", async () => {
    await invite({ name: "Bia Lima", email: "bia@x.com" });
    const first = adapters.email.token("bia@x.com")!;
    const id = adapters.users.rows.find((u) => u.email === "bia@x.com")!.id;
    await app.inject({ method: "POST", url: `/api/admin/users/${id}/invite`, headers: as() });
    expect((await app.inject({ method: "POST", url: "/api/auth/reset", payload: { token: first, password: "minha12345" } })).statusCode).toBe(400);

    const active = await addUser("ativo@x.com");
    const res = await app.inject({ method: "POST", url: `/api/admin/users/${active.id}/invite`, headers: as() });
    expect(res.statusCode).toBe(400);
  });
});

describe("Link de redefinição pelo admin (POST /api/admin/users/:id/reset-link)", () => {
  it("manda o link para a conta ativa; pendente recebe 400", async () => {
    const ana = await addUser("ana@x.com");
    expect((await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/reset-link`, headers: as() })).statusCode).toBe(202);
    expect(adapters.email.last("ana@x.com")?.text).toMatch(/redefinir-senha\?token=/);

    const pend = await addUser("pend@x.com", "pending");
    expect((await app.inject({ method: "POST", url: `/api/admin/users/${pend.id}/reset-link`, headers: as() })).statusCode).toBe(400);
  });

  it("falha no envio vira 502 EMAIL_FAILED", async () => {
    const ana = await addUser("ana@x.com");
    adapters.email.fail = true;
    const res = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/reset-link`, headers: as() });
    expect(res.json().error.code).toBe("EMAIL_FAILED");
  });
});

describe("Ativar conta avisa a pessoa por e-mail", () => {
  it("pendente → ativo manda o aviso; desbloquear por ativar não manda", async () => {
    const pend = await addUser("pend@x.com", "pending");
    await app.inject({ method: "PATCH", url: `/api/admin/users/${pend.id}/activate`, headers: as() });
    expect(adapters.email.last("pend@x.com")?.subject).toMatch(/liberada/);

    const blocked = await addUser("bloq@x.com", "blocked");
    await app.inject({ method: "PATCH", url: `/api/admin/users/${blocked.id}/activate`, headers: as() });
    expect(adapters.email.last("bloq@x.com")).toBeUndefined();
  });

  it("falha no aviso não desfaz a ativação", async () => {
    const pend = await addUser("pend@x.com", "pending");
    adapters.email.fail = true;
    const res = await app.inject({ method: "PATCH", url: `/api/admin/users/${pend.id}/activate`, headers: as() });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.status).toBe("active");
  });
});
