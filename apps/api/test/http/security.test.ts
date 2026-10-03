import Fastify, { type FastifyInstance } from "fastify";
import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { routes } from "../../src/routes/index.js";
import { makeTestContainer } from "../support/inMemory.js";

// Rotas que podem ser chamadas sem login. Qualquer outra precisa responder 401 sem token.
const PUBLIC = new Set([
  "GET /api/health",
  "GET /api/test",
  "POST /api/auth/login",
  "POST /api/auth/refresh",
  "POST /api/auth/logout",
  "POST /api/users",
  "GET /api/movements",
  "GET /api/songs",
  "GET /api/songs/:ref",
  "GET /api/flags",
]);

const ID = "6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b";
const fill = (url: string) => url.replace(/:kind/, "audio").replace(/:ref/, "1").replace(/:id/g, url.includes("/masses/") || url.includes("/users/") ? ID : "1");

async function allRoutes() {
  const found: { method: string; url: string }[] = [];
  const app = Fastify();
  app.addHook("onRoute", (r) => {
    for (const m of [r.method].flat()) if (m !== "HEAD" && m !== "OPTIONS") found.push({ method: m, url: r.url });
  });
  await app.register(routes, { prefix: "/api", container: makeTestContainer().container });
  await app.ready();
  return found;
}

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];

async function addUser(email: string, roles: ("admin" | "musico")[] = ["musico"], status: "active" | "pending" | "blocked" = "active") {
  return adapters.users.create({ name: email.split("@")[0], email, passwordHash: await adapters.hasher.hash("senha1234"), phone: null, movementId: null, status, roles });
}
const login = (email: string, password = "senha1234") => app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password } });
const tokenOf = async (email: string) => (await login(email)).json().accessToken as string;

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
});

describe("Matriz de autorização (todas as rotas registradas)", async () => {
  const list = await allRoutes();
  const protectedRoutes = list.filter((r) => !PUBLIC.has(`${r.method} ${r.url}`));
  const adminRoutes = list.filter((r) => r.url.startsWith("/api/admin/"));

  it("a lista de rotas públicas é exatamente a esperada (rota pública nova precisa entrar aqui de propósito)", () => {
    const publics = list.filter((r) => PUBLIC.has(`${r.method} ${r.url}`)).map((r) => `${r.method} ${r.url}`);
    expect(publics.sort()).toEqual([...PUBLIC].sort());
    expect(protectedRoutes.length).toBeGreaterThan(30);
  });

  it.each(protectedRoutes.map((r) => [`${r.method} ${r.url}`, r] as const))("%s sem token → 401", async (_n, r) => {
    const res = await app.inject({ method: r.method as "GET", url: fill(r.url), payload: r.method === "GET" || r.method === "DELETE" ? undefined : {} });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });

  it.each(adminRoutes.map((r) => [`${r.method} ${r.url}`, r] as const))("%s com token de músico → 403", async (_n, r) => {
    await addUser("musico@x.com");
    const token = await tokenOf("musico@x.com");
    const res = await app.inject({
      method: r.method as "GET",
      url: fill(r.url),
      headers: { authorization: `Bearer ${token}` },
      payload: r.method === "GET" || r.method === "DELETE" ? undefined : {},
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Tokens forjados", () => {
  it("JWT de admin assinado com outro segredo não passa", async () => {
    const forged = await new SignJWT({ roles: ["admin"] })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(ID)
      .setIssuer("psjb-cantos-api")
      .setAudience("psjb-cantos-web")
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("um-segredo-qualquer-que-alguem-chutou-123"));
    const res = await app.inject({ method: "GET", url: "/api/admin/users", headers: { authorization: `Bearer ${forged}` } });
    expect(res.statusCode).toBe(401);
  });

  it("cabeçalho Authorization malformado → 401", async () => {
    for (const authorization of ["Bearer", "Basic YWRtaW46YWRtaW4=", "bearer abc", "Bearer  "]) {
      expect((await app.inject({ method: "GET", url: "/api/me", headers: { authorization } })).statusCode).toBe(401);
    }
  });
});

describe("Conta bloqueada depois do login", () => {
  it("/me deixa de funcionar e o refresh derruba a sessão", async () => {
    const u = await addUser("ana@x.com");
    const res = await login("ana@x.com");
    const { accessToken } = res.json();
    const cookie = res.cookies.find((c) => c.name === "psjb_refresh")!.value;

    await adapters.users.updateStatus(u.id, "blocked", "Teste");
    expect((await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${accessToken}` } })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: cookie } })).statusCode).toBe(401);
    expect(adapters.sessions.rows.every((s) => s.revokedAt)).toBe(true);
  });

  it("refresh com sessão vencida → 401 e o cookie é apagado", async () => {
    await addUser("ana@x.com");
    const res = await login("ana@x.com");
    adapters.sessions.rows[0].expiresAt = new Date(Date.now() - 1000);
    const refresh = await app.inject({ method: "POST", url: "/api/auth/refresh", cookies: { psjb_refresh: res.cookies[0].value } });
    expect(refresh.statusCode).toBe(401);
    expect(refresh.cookies.find((c) => c.name === "psjb_refresh")?.value).toBe("");
  });
});

describe("Cadastro e login", () => {
  it("cadastro ignora papel e status no corpo (sem mass assignment)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { name: "Invasor", email: "x@x.com", password: "senha1234", roles: ["admin"], status: "active" },
    });
    expect(res.json().user).toMatchObject({ roles: ["musico"], status: "pending" });
  });

  it("e-mail inexistente também passa pela verificação de senha (o tempo não revela quem tem conta)", async () => {
    const verify = vi.spyOn(adapters.hasher, "verify");
    await login("ninguem@x.com", "qualquer");
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it("status de conta (pendente/bloqueada) só aparece para quem acertou a senha", async () => {
    await addUser("pend@x.com", ["musico"], "pending");
    expect((await login("pend@x.com", "errada")).json().error.code).toBe("INVALID_CREDENTIALS");
    expect((await login("pend@x.com")).json().error.code).toBe("ACCOUNT_PENDING");
  });

  it("nenhuma resposta traz senha ou hash", async () => {
    await addUser("admin@x.com", ["admin"]);
    const token = await tokenOf("admin@x.com");
    const bodies = [
      (await app.inject({ method: "POST", url: "/api/users", payload: { name: "Nova Pessoa", email: "nova@x.com", password: "senha1234" } })).body,
      (await login("admin@x.com")).body,
      (await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } })).body,
      (await app.inject({ method: "GET", url: "/api/admin/users", headers: { authorization: `Bearer ${token}` } })).body,
      (await app.inject({ method: "GET", url: "/api/users/search?q=", headers: { authorization: `Bearer ${token}` } })).body,
    ];
    for (const b of bodies) expect(b).not.toMatch(/password|hashed:|senha1234/i);
  });
});

describe("Erros e cabeçalhos", () => {
  it("erro inesperado vira 500 genérico, sem detalhes internos", async () => {
    await addUser("ana@x.com");
    const token = await tokenOf("ana@x.com");
    vi.spyOn(adapters.users, "findById").mockRejectedValueOnce(new Error('relation "users" senha=segredo do banco'));
    const res = await app.inject({ method: "GET", url: "/api/me", headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: expect.any(String) } });
    expect(res.body).not.toMatch(/segredo|relation|stack/);
  });

  it("JSON malformado → 400 e rota inexistente → 404, no formato padrão", async () => {
    const bad = await app.inject({ method: "POST", url: "/api/auth/login", headers: { "content-type": "application/json" }, payload: "{oops" });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe("BAD_REQUEST");
    const missing = await app.inject({ method: "GET", url: "/api/nao-existe" });
    expect(missing.json()).toEqual({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } });
  });

  it("cabeçalhos de segurança do helmet", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=/);
    expect(res.headers["content-security-policy"]).toBeTruthy();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS só libera a origem do site, com credenciais", async () => {
    const evil = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "https://site-malicioso.com" } });
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
    const site = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://localhost:3000" } });
    expect(site.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(site.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("foto acima de 2 MB é recusada", async () => {
    await addUser("ana@x.com");
    const token = await tokenOf("ana@x.com");
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2 * 1024 * 1024)]);
    const boundary = "----b";
    const res = await app.inject({
      method: "PUT",
      url: "/api/me/photo",
      headers: { authorization: `Bearer ${token}`, "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="a.png"\r\n\r\n`), big, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    });
    expect(res.statusCode).toBe(415);
    expect(adapters.storage.files.size).toBe(0);
  });
});

describe("Em produção", () => {
  let prod: FastifyInstance;
  beforeEach(async () => {
    const t = makeTestContainer({ NODE_ENV: "production", JWT_SECRET: "segredo-de-producao-com-mais-de-32-caracteres" });
    adapters = t.adapters;
    prod = await buildApp({ container: t.container, logger: false });
  });

  it("cookie do refresh é Secure + HttpOnly + SameSite=Lax, só no caminho /api/auth", async () => {
    await addUser("ana@x.com");
    const res = await prod.inject({ method: "POST", url: "/api/auth/login", payload: { email: "ana@x.com", password: "senha1234" } });
    expect(res.cookies[0]).toMatchObject({ name: "psjb_refresh", secure: true, httpOnly: true, sameSite: "Lax", path: "/api/auth" });
  });

  it("limite de tentativas de login: a 11ª em 15 min recebe 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++)
      codes.push((await prod.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@x.com", password: "x" }, remoteAddress: "10.0.0.1" })).statusCode);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes[10]).toBe(429);
    // Outro IP não é afetado.
    expect((await prod.inject({ method: "POST", url: "/api/auth/login", payload: { email: "a@x.com", password: "x" }, remoteAddress: "10.0.0.2" })).statusCode).toBe(401);
  });

  it("a API não sobe em produção com o segredo de desenvolvimento", () => {
    expect(() => makeTestContainer({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);
  });
});
