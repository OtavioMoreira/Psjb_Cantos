import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv } from "../../src/config/env.js";
import { buildContainer, createAdapters } from "../../src/container.js";
import { Argon2PasswordHasher } from "../../src/services/Argon2PasswordHasher.js";
import { MemoryStorage } from "../support/inMemory.js";
import { dbUrl, useTestDb } from "../support/db.js";

/**
 * A API inteira (rotas → controllers → actions → repositórios Postgres), como em produção.
 * Pega erros que os testes em memória não veem: SQL, tipos de parâmetro, mapeamento query string → filtro.
 */
describe.skipIf(!dbUrl)("API com Postgres de verdade", () => {
  const { repos, pool } = useTestDb();
  let app: FastifyInstance;
  let adapters: ReturnType<typeof createAdapters>;

  beforeAll(async () => {
    const env = loadEnv({ NODE_ENV: "test", DATABASE_URL: dbUrl! });
    adapters = createAdapters(env);
    app = await buildApp({ container: buildContainer(env, { ...adapters, storage: new MemoryStorage() }), logger: false });
  });
  afterAll(async () => {
    await app.close();
    await adapters.pool.end();
  });

  const call = (method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, token?: string, payload?: object) =>
    app.inject({ method, url: `/api${url}`, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });

  async function admin() {
    const hash = await new Argon2PasswordHasher().hash("admin1234");
    const u = await repos.users.create({ name: "Admin", email: "admin@teste.com", passwordHash: hash, phone: null, movementId: null, status: "active", roles: ["admin", "musico"] });
    const token = (await call("POST", "/auth/login", undefined, { email: "admin@teste.com", password: "admin1234" })).json().accessToken as string;
    return { u, token };
  }

  it("cadastro → ativação → login → refresh → /me (com argon2 e sessões reais)", async () => {
    const { token: adminToken } = await admin();
    const mv = (await call("POST", "/admin/movements", adminToken, { name: "Catequese" })).json().movement;
    const signup = await call("POST", "/users", undefined, { name: "Clara Souza", email: "Clara@Teste.com", password: "cantos2026", movementId: mv.id });
    expect(signup.json().user).toMatchObject({ email: "clara@teste.com", status: "pending", movement: { name: "Catequese" } });

    expect((await call("POST", "/auth/login", undefined, { email: "clara@teste.com", password: "cantos2026" })).json().error.code).toBe("ACCOUNT_PENDING");
    await call("PATCH", `/admin/users/${signup.json().user.id}/activate`, adminToken);

    const login = await call("POST", "/auth/login", undefined, { email: " CLARA@teste.com", password: "cantos2026" });
    const cookie = login.cookies.find((c) => c.name === "psjb_refresh")!.value;
    const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: cookie } });
    expect(refresh.statusCode).toBe(200);
    // Reuso do cookie antigo derruba a família no banco.
    expect((await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: cookie } })).statusCode).toBe(401);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM sessions WHERE revoked_at IS NULL");
    expect(rows[0].n).toBe(1); // só a sessão do admin

    expect((await call("GET", "/me", refresh.json().accessToken)).json().user.lastLoginAt).toBeTruthy();
  });

  // Regressão: ?flags= chegava ao repositório com o nome errado e o filtro não filtrava.
  it("repertório: ?flags= e ?q= pela URL chegam ao SQL", async () => {
    const { token } = await admin();
    const flag = async (group: string, slug: string) => (await call("POST", "/admin/flags", token, { group, slug, name: slug })).json().flag.id as number;
    const [adv, nat, ent] = [await flag("tempo", "advento"), await flag("tempo", "natal"), await flag("momento", "entrada")];
    await call("POST", "/admin/songs", token, { title: "Ó Vem, Senhor", number: 1, flagIds: [adv, ent] });
    await call("POST", "/admin/songs", token, { title: "Noite Feliz", number: 2, flagIds: [nat] });
    await call("POST", "/admin/songs", token, { title: "Escondido", number: 3, flagIds: [adv], active: false });

    const titles = async (qs: string) => (await call("GET", `/songs?${qs}`)).json().songs.map((s: { title: string }) => s.title);
    expect(await titles(`flags=${adv}`)).toEqual(["Ó Vem, Senhor"]);
    expect(await titles(`flags=${adv},${nat}`)).toEqual(["Ó Vem, Senhor", "Noite Feliz"]);
    expect(await titles(`flags=${adv},${nat},${ent}`)).toEqual(["Ó Vem, Senhor"]);
    expect(await titles("q=o vem")).toEqual(["Ó Vem, Senhor"]);
    expect(await titles("q=002")).toEqual(["Noite Feliz"]);
    expect((await call("GET", "/songs/003-escondido")).statusCode).toBe(404);
  });

  it("missa com canto real → link de convite → convidado entra → canto em uso não é excluído", async () => {
    const { token: adminToken } = await admin();
    const song = (await call("POST", "/admin/songs", adminToken, { title: "Entrada" })).json().song;

    const hash = await new Argon2PasswordHasher().hash("cantos2026");
    await repos.users.create({ name: "Bruno", email: "bruno@teste.com", passwordHash: hash, phone: null, movementId: null, status: "active", roles: ["musico"] });
    const bruno = (await call("POST", "/auth/login", undefined, { email: "bruno@teste.com", password: "cantos2026" })).json().accessToken;

    const id = "6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b";
    const created = await call("POST", "/masses", adminToken, {
      id,
      name: "Domingo",
      date: "2026-10-11",
      time: "19:00",
      slots: [{ id: "s1", moment: "entrada", label: "Entrada", items: [{ songId: song.id, transpose: 2 }] }],
    });
    expect(created.statusCode).toBe(201);
    expect((await call("POST", "/masses", adminToken, { slots: [{ id: "x", moment: "entrada", label: "E", items: [{ songId: 99999 }] }] })).json().error.details.unknownSongIds).toEqual([99999]);

    expect((await call("GET", `/masses/${id}`, bruno)).statusCode).toBe(403);
    const { token } = (await call("POST", `/masses/${id}/share-link`, adminToken)).json();
    expect((await call("POST", "/masses/join", bruno, { token })).json().mass).toMatchObject({ id, access: "shared", shareToken: null });
    expect((await call("GET", "/masses", bruno)).json().masses.map((m: { id: string }) => m.id)).toEqual([id]);

    expect((await call("DELETE", `/admin/songs/${song.id}`, adminToken)).json().error.code).toBe("SONG_IN_USE");
    await call("DELETE", `/masses/${id}/share-link`, adminToken);
    expect((await call("POST", "/masses/join", bruno, { token })).statusCode).toBe(404);
    expect((await call("GET", `/masses/${id}`, bruno)).statusCode).toBe(200);
  });
});
