import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { Role, UserStatus } from "../../src/domain/user.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

const PASSWORD = "senha1234";

async function addUser(email: string, roles: Role[] = ["musico"], status: UserStatus = "active") {
  return adapters.users.create({ name: email.split("@")[0], email, passwordHash: await adapters.hasher.hash(PASSWORD), phone: null, movementId: null, status, roles });
}
const login = (email: string, password = PASSWORD) => app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
const tokenOf = async (email: string, password = PASSWORD) => (await login(email, password)).json().accessToken as string;
const as = (token: string) => ({ authorization: `Bearer ${token}` });

let adminId: string;
let adminToken: string;

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  adminId = (await addUser("admin@x.com", ["admin", "musico"])).id;
  adminToken = await tokenOf("admin@x.com");
});

describe("PATCH /api/me", () => {
  it("atualiza só os campos enviados (nome, telefone, movimento, paróquia, instrumento)", async () => {
    const mv = await adapters.movements.create("RCC");
    const res = await app.inject({
      method: "PATCH",
      url: "/api/me",
      headers: as(adminToken),
      payload: { name: "  Ana Admin ", movementId: mv.id, parish: "Catedral", instrument: "Violão" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ name: "Ana Admin", movement: { id: mv.id, name: "RCC" }, parish: "Catedral", instrument: "Violão", email: "admin@x.com" });

    const clear = await app.inject({ method: "PATCH", url: "/api/me", headers: as(adminToken), payload: { parish: "", movementId: null } });
    expect(clear.json().user).toMatchObject({ name: "Ana Admin", parish: null, movement: null, instrument: "Violão" });
  });

  it("não aceita e-mail, papel nem status (mass assignment) e confere o movimento", async () => {
    for (const payload of [{ email: "novo@x.com" }, { roles: ["admin"] }, { status: "active" }]) {
      const res = await app.inject({ method: "PATCH", url: "/api/me", headers: as(adminToken), payload });
      expect(res.statusCode).toBe(400);
    }
    const res = await app.inject({ method: "PATCH", url: "/api/me", headers: as(adminToken), payload: { movementId: 999 } });
    expect(res.json().error.details.fields).toEqual({ movementId: "Movimento não encontrado." });
  });
});

describe("POST /api/auth/password", () => {
  it("exige a senha atual, troca e derruba só as sessões dos outros aparelhos", async () => {
    await addUser("ana@x.com");
    const other = await login("ana@x.com");
    const here = await login("ana@x.com");
    const cookie = here.cookies.find((c) => c.name === "psjb_refresh")!.value;
    const otherCookie = other.cookies.find((c) => c.name === "psjb_refresh")!.value;
    const headers = { ...as(here.json().accessToken), cookie: `psjb_refresh=${cookie}` };

    const wrong = await app.inject({ method: "POST", url: "/api/auth/password", headers, payload: { currentPassword: "errada", newPassword: "nova12345" } });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().error.details.fields).toEqual({ currentPassword: "Senha atual incorreta." });

    const weak = await app.inject({ method: "POST", url: "/api/auth/password", headers, payload: { currentPassword: PASSWORD, newPassword: "curta" } });
    expect(weak.statusCode).toBe(400);

    const ok = await app.inject({ method: "POST", url: "/api/auth/password", headers, payload: { currentPassword: PASSWORD, newPassword: "nova12345" } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().user.mustChangePassword).toBe(false);

    expect((await login("ana@x.com")).statusCode).toBe(401);
    expect((await login("ana@x.com", "nova12345")).statusCode).toBe(200);

    const refresh = (c: string) => app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: `psjb_refresh=${c}` } });
    expect((await refresh(cookie)).statusCode).toBe(200);
    expect((await refresh(otherCookie)).statusCode).toBe(401);
  });

  it("a nova senha precisa ser diferente da atual", async () => {
    const res = await app.inject({ method: "POST", url: "/api/auth/password", headers: as(adminToken), payload: { currentPassword: PASSWORD, newPassword: PASSWORD } });
    expect(res.json().error.details.fields).toEqual({ newPassword: "A nova senha precisa ser diferente da atual." });
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("edita nome, e-mail, movimento e papéis", async () => {
    const ana = await addUser("ana@x.com");
    const mv = await adapters.movements.create("Catequese");
    const res = await app.inject({
      method: "PATCH",
      url: `/api/admin/users/${ana.id}`,
      headers: as(adminToken),
      payload: { name: "Ana Souza", email: " ANA.SOUZA@x.com", movementId: mv.id, roles: ["admin", "musico", "admin"] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toMatchObject({ name: "Ana Souza", email: "ana.souza@x.com", movement: { name: "Catequese" }, roles: ["admin", "musico"] });
  });

  it("e-mail de outra conta → 409; papel inexistente ou lista vazia → 400", async () => {
    const ana = await addUser("ana@x.com");
    const dup = await app.inject({ method: "PATCH", url: `/api/admin/users/${ana.id}`, headers: as(adminToken), payload: { email: "admin@x.com" } });
    expect(dup.statusCode).toBe(409);
    for (const roles of [[], ["coordenador"]]) {
      const res = await app.inject({ method: "PATCH", url: `/api/admin/users/${ana.id}`, headers: as(adminToken), payload: { roles } });
      expect(res.statusCode).toBe(400);
    }
  });

  it("o admin não tira o próprio papel de administrador", async () => {
    await addUser("outro@x.com", ["admin"]);
    const res = await app.inject({ method: "PATCH", url: `/api/admin/users/${adminId}`, headers: as(adminToken), payload: { roles: ["musico"] } });
    expect(res.statusCode).toBe(403);
    // Mudar outros dados de si mesmo pode.
    const ok = await app.inject({ method: "PATCH", url: `/api/admin/users/${adminId}`, headers: as(adminToken), payload: { name: "Admin Novo" } });
    expect(ok.statusCode).toBe(200);
  });

  it("rebaixar outro admin é permitido enquanto sobrar um admin ativo", async () => {
    const outro = await addUser("outro@x.com", ["admin"]);
    const res = await app.inject({ method: "PATCH", url: `/api/admin/users/${outro.id}`, headers: as(adminToken), payload: { roles: ["musico"] } });
    expect(res.json().user.roles).toEqual(["musico"]);
  });

  it("404 para usuário inexistente", async () => {
    const res = await app.inject({ method: "PATCH", url: "/api/admin/users/6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b", headers: as(adminToken), payload: { name: "Fulano" } });
    expect(res.statusCode).toBe(404);
  });
});

describe("Bloquear e liberar", () => {
  it("bloqueia com motivo, derruba as sessões e o login mostra o motivo; liberar volta para ativo", async () => {
    const ana = await addUser("ana@x.com");
    const session = await login("ana@x.com");
    const cookie = session.cookies.find((c) => c.name === "psjb_refresh")!.value;

    const res = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/block`, headers: as(adminToken), payload: { reason: "Cadastro duplicado" } });
    expect(res.json().user).toMatchObject({ status: "blocked", blockedReason: "Cadastro duplicado" });

    const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: `psjb_refresh=${cookie}` } });
    expect(refresh.statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/me", headers: as(session.json().accessToken) })).statusCode).toBe(401);
    expect((await login("ana@x.com")).json().error).toMatchObject({ code: "ACCOUNT_BLOCKED", details: { reason: "Cadastro duplicado" } });

    const unblock = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/unblock`, headers: as(adminToken) });
    expect(unblock.json().user).toMatchObject({ status: "active", blockedReason: null });
    expect((await login("ana@x.com")).statusCode).toBe(200);
  });

  it("motivo é opcional; liberar quem não está bloqueado não muda nada", async () => {
    const ana = await addUser("ana@x.com", ["musico"], "pending");
    const unblock = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/unblock`, headers: as(adminToken) });
    expect(unblock.json().user.status).toBe("pending");
    const block = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/block`, headers: as(adminToken) });
    expect(block.json().user).toMatchObject({ status: "blocked", blockedReason: null });
  });

  it("o admin não bloqueia a si mesmo", async () => {
    const res = await app.inject({ method: "POST", url: `/api/admin/users/${adminId}/block`, headers: as(adminToken), payload: {} });
    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("exclui a conta e apaga a foto", async () => {
    const ana = await addUser("ana@x.com");
    await adapters.storage.put("users/ana/foto.png", Buffer.from("x"), "image/png");
    await adapters.users.updatePhoto(ana.id, "mem://users/ana/foto.png");

    const res = await app.inject({ method: "DELETE", url: `/api/admin/users/${ana.id}`, headers: as(adminToken) });
    expect(res.statusCode).toBe(204);
    expect(await adapters.users.findById(ana.id)).toBeNull();
    expect(adapters.storage.files.size).toBe(0);
    expect((await app.inject({ method: "DELETE", url: `/api/admin/users/${ana.id}`, headers: as(adminToken) })).statusCode).toBe(404);
  });

  it("o admin não exclui a si mesmo", async () => {
    const res = await app.inject({ method: "DELETE", url: `/api/admin/users/${adminId}`, headers: as(adminToken) });
    expect(res.statusCode).toBe(403);
  });
});

describe("Sempre sobra pelo menos um admin ativo", () => {
  // Um admin ativo nunca é o último ao agir sobre outra pessoa (ele mesmo conta). A regra pesa quando
  // quem age já foi bloqueado ou rebaixado, mas ainda tem um access token válido (até 15 min).
  it("admin com token antigo não bloqueia, exclui nem rebaixa o último admin ativo", async () => {
    await addUser("outro@x.com", ["admin"]);
    const staleToken = await tokenOf("outro@x.com");
    const outro = adapters.users.rows.find((u) => u.email === "outro@x.com")!;
    await adapters.users.updateStatus(outro.id, "blocked", null);

    for (const req of [
      { method: "POST" as const, url: `/api/admin/users/${adminId}/block`, payload: {} },
      { method: "DELETE" as const, url: `/api/admin/users/${adminId}` },
      { method: "PATCH" as const, url: `/api/admin/users/${adminId}`, payload: { roles: ["musico"] } },
    ]) {
      const res = await app.inject({ ...req, headers: as(staleToken) });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("LAST_ADMIN");
    }
    expect((await adapters.users.findById(adminId))?.status).toBe("active");
  });

  it("admin pendente não conta como ativo", async () => {
    await addUser("pendente@x.com", ["admin"], "pending");
    expect(await adapters.users.countActiveAdmins(adminId)).toBe(0);
  });
});

describe("POST /api/admin/users/:id/reset-password", () => {
  it("gera senha temporária mostrada uma vez, derruba as sessões e obriga a troca", async () => {
    const ana = await addUser("ana@x.com");
    const old = await login("ana@x.com");
    const cookie = old.cookies.find((c) => c.name === "psjb_refresh")!.value;

    const res = await app.inject({ method: "POST", url: `/api/admin/users/${ana.id}/reset-password`, headers: as(adminToken) });
    expect(res.statusCode).toBe(200);
    const { temporaryPassword, user } = res.json();
    expect(temporaryPassword).toMatch(/^[a-z]{4}-[2-9]{2}[a-z2-9]{2}$/);
    expect(user.mustChangePassword).toBe(true);

    expect((await app.inject({ method: "POST", url: "/api/auth/refresh", headers: { cookie: `psjb_refresh=${cookie}` } })).statusCode).toBe(401);
    expect((await login("ana@x.com")).statusCode).toBe(401);

    const entered = await login("ana@x.com", temporaryPassword);
    expect(entered.json().user.mustChangePassword).toBe(true);

    const change = await app.inject({
      method: "POST",
      url: "/api/auth/password",
      headers: as(entered.json().accessToken),
      payload: { currentPassword: temporaryPassword, newPassword: "minha12345" },
    });
    expect(change.json().user.mustChangePassword).toBe(false);
    expect((await login("ana@x.com", "minha12345")).json().user.mustChangePassword).toBe(false);
  });
});
