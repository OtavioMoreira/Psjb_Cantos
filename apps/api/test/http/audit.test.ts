import Fastify, { type FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/buildApp.js";
import { AUDIT_RULES } from "../../src/http/audit.js";
import { routes } from "../../src/routes/index.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
let adminToken: string;

const addUser = async (email: string, roles: ("admin" | "musico")[] = ["musico"], name = email.split("@")[0]) =>
  adapters.users.create({ name, email, passwordHash: await adapters.hasher.hash("senha1234"), phone: null, movementId: null, status: "active", roles });
const tokenOf = async (email: string) =>
  (await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "senha1234" } })).json().accessToken as string;
const admin = (method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", url: string, payload?: object, token = adminToken) =>
  app.inject({ method, url: `/api/admin${url}`, headers: { authorization: `Bearer ${token}` }, payload });
const entries = async (qs = "") => (await admin("GET", `/audit${qs}`)).json().entries as { action: string; targetLabel: string; actorName: string; details: Record<string, unknown> }[];

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  await addUser("padre@x.com", ["admin", "musico"], "Padre João");
  adminToken = await tokenOf("padre@x.com");
});

describe("Auditoria das ações de admin", () => {
  it("toda rota de admin que altera algo tem uma regra de auditoria (rota nova precisa entrar)", async () => {
    const found: string[] = [];
    const probe = Fastify();
    probe.addHook("onRoute", (r) => {
      for (const m of [r.method].flat()) if (m !== "GET" && m !== "HEAD" && r.url.startsWith("/api/admin/")) found.push(`${m} ${r.url.replace("/api/admin", "")}`);
    });
    await probe.register(routes, { prefix: "/api", container: makeTestContainer().container });
    await probe.ready();
    expect(found.filter((k) => !AUDIT_RULES[k])).toEqual([]);
    expect(Object.keys(AUDIT_RULES).filter((k) => !found.includes(k))).toEqual([]);
  });

  it("bloquear grava quem fez, o alvo e o motivo; mais recentes primeiro", async () => {
    const maria = await addUser("maria@x.com", ["musico"], "Maria Souza");
    await admin("POST", `/users/${maria.id}/block`, { reason: "Conta duplicada" });
    await admin("POST", `/users/${maria.id}/unblock`);
    const list = await entries();
    expect(list.map((e) => e.action)).toEqual(["user.unblock", "user.block"]);
    expect(list[1]).toMatchObject({ actorName: "Padre João", targetLabel: "Maria Souza", details: { reason: "Conta duplicada" } });
  });

  it("excluir guarda o nome de antes; criação guarda o id novo", async () => {
    const zeca = await addUser("zeca@x.com", ["musico"], "Zeca");
    await admin("DELETE", `/users/${zeca.id}`);
    const created = (await admin("POST", "/movements", { name: "Coral" })).json().movement;
    const [mv, del] = await entries();
    expect(del).toMatchObject({ action: "user.delete", targetLabel: "Zeca" });
    expect(mv).toMatchObject({ action: "movement.create", targetLabel: "Coral", targetId: String(created.id) });
  });

  it("nunca grava a senha temporária nem a letra; só os nomes dos campos", async () => {
    const ana = await addUser("ana@x.com");
    const reset = await admin("POST", `/users/${ana.id}/reset-password`);
    const song = (await admin("POST", "/songs", { title: "Canto", lyrics: "D\nSegredo da letra" })).json().song;
    await admin("PATCH", `/songs/${song.id}`, { lyrics: "G\nOutra letra" });
    const raw = JSON.stringify(adapters.audit.rows);
    expect(raw).not.toContain(reset.json().temporaryPassword);
    expect(raw).not.toContain("Segredo da letra");
    expect(raw).not.toContain("Outra letra");
    expect((await entries())[0]).toMatchObject({ action: "song.update", details: { fields: ["lyrics"] } });
  });

  it("ação recusada não vira registro; falha na auditoria não derruba a ação", async () => {
    const me = adapters.users.rows[0];
    expect((await admin("POST", `/users/${me.id}/block`, {})).statusCode).toBe(403);
    expect(adapters.audit.rows).toHaveLength(0);

    adapters.audit.fail = true;
    const ana = await addUser("ana@x.com");
    expect((await admin("PATCH", `/users/${ana.id}/activate`)).statusCode).toBe(200);
  });

  it("GET /api/admin/audit: só admin, paginado e filtrável por tipo", async () => {
    await admin("POST", "/movements", { name: "Coral" });
    await admin("POST", "/flags", { group: "tema", slug: "paz", name: "Paz" });
    const res = await admin("GET", "/audit?targetType=flag&pageSize=1");
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 1, entries: [{ action: "flag.create", targetLabel: "Paz" }] });
    // Ler a auditoria não vira registro.
    expect(adapters.audit.rows).toHaveLength(2);

    await addUser("musico@x.com");
    expect((await admin("GET", "/audit", undefined, await tokenOf("musico@x.com"))).statusCode).toBe(403);
  });
});
