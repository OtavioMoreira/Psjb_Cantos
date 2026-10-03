import { beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { Role, UserStatus } from "../../src/domain/user.js";
import { makeTestContainer } from "../support/inMemory.js";

let app: FastifyInstance;
let adapters: ReturnType<typeof makeTestContainer>["adapters"];
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

async function addUser(key: string, opts: { roles?: Role[]; status?: UserStatus } = {}) {
  const email = `${key}@psjb.org.br`;
  const u = await adapters.users.create({
    name: key[0].toUpperCase() + key.slice(1),
    email,
    passwordHash: await adapters.hasher.hash("senha1234"),
    phone: null,
    movementId: null,
    status: opts.status ?? "active",
    roles: opts.roles ?? ["musico"],
  });
  ids[key] = u.id;
  if ((opts.status ?? "active") === "active") {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: "senha1234" } });
    tokens[key] = res.json().accessToken;
  }
}

const as = (key: string) => ({ authorization: `Bearer ${tokens[key]}` });
const req = (key: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url: `/api${url}`, headers: as(key), payload });

const MASS = {
  name: "Domingo — Missa das 19h",
  date: "2026-10-11",
  time: "19:00",
  season: "tempo-comum",
  year: "A",
  slots: [
    { id: "s1", moment: "entrada", label: "Entrada", items: [{ songId: 1, transpose: 2 }] },
    { id: "s2", moment: "extra", label: "Ação de graças", items: [] },
  ],
};

beforeEach(async () => {
  const t = makeTestContainer();
  adapters = t.adapters;
  app = await buildApp({ container: t.container, logger: false });
  await addUser("admin", { roles: ["admin", "musico"] });
  await addUser("ana");
  await addUser("bruno");
  await addUser("pendente", { status: "pending" });
  // Cantos usados nas missas de teste (songId 1, 2, ...).
  for (const title of ["Entrada A", "Entrada B"])
    await adapters.songs.create({ number: null, slug: title.toLowerCase().replace(" ", "-"), title, composer: null, key: null, lyrics: "", media: { audio: null, audiomack: null, cifraPdf: null, partituraPdf: null }, flagIds: [], active: true });
});

async function createMass(owner = "ana") {
  const res = await req(owner, "POST", "/masses", MASS);
  expect(res.statusCode).toBe(201);
  return res.json().mass as { id: string; access: string; slots: unknown[] };
}

describe("CRUD de missas", () => {
  it("cria, lê, lista, edita (PUT e PATCH) e exclui", async () => {
    const mass = await createMass();
    expect(mass).toMatchObject({ access: "owner", name: MASS.name, date: "2026-10-11", owner: { id: ids.ana } });

    expect((await req("ana", "GET", `/masses/${mass.id}`)).json().mass.slots).toEqual(MASS.slots);
    expect((await req("ana", "GET", "/masses")).json().masses).toHaveLength(1);

    const put = await req("ana", "PUT", `/masses/${mass.id}`, { name: "Novo nome" });
    // PUT substitui: o que não veio volta ao padrão.
    expect(put.json().mass).toMatchObject({ name: "Novo nome", date: null, slots: [] });

    const patch = await req("ana", "PATCH", `/masses/${mass.id}`, { date: "2026-12-25", season: "natal" });
    expect(patch.json().mass).toMatchObject({ name: "Novo nome", date: "2026-12-25", season: "natal" });

    expect((await req("ana", "DELETE", `/masses/${mass.id}`)).statusCode).toBe(204);
    expect((await req("ana", "GET", `/masses/${mass.id}`)).statusCode).toBe(404);
  });

  it("valida a entrada: tom fora de −6..+5, data, momento e PATCH vazio", async () => {
    const bad = await req("ana", "POST", "/masses", {
      date: "11/10/2026",
      slots: [{ id: "x", moment: "abertura", label: "X", items: [{ songId: 1, transpose: 9 }] }],
    });
    expect(bad.statusCode).toBe(400);
    expect(Object.keys(bad.json().error.details.fields)).toEqual(expect.arrayContaining(["date", "slots.0.moment", "slots.0.items.0.transpose"]));

    const mass = await createMass();
    expect((await req("ana", "PATCH", `/masses/${mass.id}`, {})).statusCode).toBe(400);
  });

  it("sem login: 401", async () => {
    expect((await app.inject({ method: "GET", url: "/api/masses" })).statusCode).toBe(401);
  });
});

describe("Permissões e compartilhamento", () => {
  it("quem não é dono nem convidado recebe 403", async () => {
    const mass = await createMass();
    expect((await req("bruno", "GET", `/masses/${mass.id}`)).statusCode).toBe(403);
    expect((await req("bruno", "PATCH", `/masses/${mass.id}`, { name: "x" })).statusCode).toBe(403);
    // Admin também não vê missa alheia: a missa é pessoal.
    expect((await req("admin", "GET", `/masses/${mass.id}`)).statusCode).toBe(403);
  });

  it("convidado vê e edita, mas não exclui nem compartilha; pode sair", async () => {
    const mass = await createMass();
    const shared = await req("ana", "PUT", `/masses/${mass.id}/shares`, { userIds: [ids.bruno, ids.ana] });
    // O próprio dono é ignorado na lista.
    expect(shared.json().mass.sharedWith.map((p: { id: string }) => p.id)).toEqual([ids.bruno]);

    const seen = await req("bruno", "GET", "/masses");
    expect(seen.json().masses[0]).toMatchObject({ id: mass.id, access: "shared" });
    expect((await req("bruno", "PATCH", `/masses/${mass.id}`, { name: "Editado pelo Bruno" })).statusCode).toBe(200);

    expect((await req("bruno", "DELETE", `/masses/${mass.id}`)).statusCode).toBe(403);
    expect((await req("bruno", "PUT", `/masses/${mass.id}/shares`, { userIds: [] })).statusCode).toBe(403);

    expect((await req("bruno", "DELETE", `/masses/${mass.id}/shares/me`)).statusCode).toBe(204);
    expect((await req("bruno", "GET", "/masses")).json().masses).toHaveLength(0);
    expect((await req("ana", "GET", `/masses/${mass.id}`)).json().mass.name).toBe("Editado pelo Bruno");
  });

  it("só compartilha com contas ativas", async () => {
    const mass = await createMass();
    const res = await req("ana", "PUT", `/masses/${mass.id}/shares`, { userIds: [ids.bruno, ids.pendente] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.details.invalidUserIds).toEqual([ids.pendente]);
  });

  it("dono não pode 'sair' da própria missa", async () => {
    const mass = await createMass();
    expect((await req("ana", "DELETE", `/masses/${mass.id}/shares/me`)).statusCode).toBe(403);
  });

  it("duplicar: a cópia é de quem duplicou, sem data e sem compartilhamento", async () => {
    const mass = await createMass();
    await req("ana", "PUT", `/masses/${mass.id}/shares`, { userIds: [ids.bruno] });
    const copy = (await req("bruno", "POST", `/masses/${mass.id}/duplicate`)).json().mass;
    expect(copy).toMatchObject({ name: `Cópia de ${MASS.name}`, date: null, sharedWith: [], access: "owner", owner: { id: ids.bruno } });
    expect(copy.slots).toEqual(MASS.slots);
  });

  it("busca de pessoas para compartilhar: só ativas e sem a própria pessoa", async () => {
    const res = await req("ana", "GET", "/users/search?q=");
    const names = res.json().users.map((u: { name: string }) => u.name);
    expect(names).toEqual(expect.arrayContaining(["Admin", "Bruno"]));
    expect(names).not.toContain("Ana");
    expect(names).not.toContain("Pendente");
  });
});

describe("Link de convite", () => {
  it("dono gera o link (sempre o mesmo); quem entra pelo link vira convidado", async () => {
    const mass = await createMass();
    const link = (await req("ana", "POST", `/masses/${mass.id}/share-link`)).json();
    expect(link.path).toBe(`/convite?token=${link.token}`);
    expect((await req("ana", "POST", `/masses/${mass.id}/share-link`)).json().token).toBe(link.token);
    expect((await req("ana", "GET", `/masses/${mass.id}`)).json().mass.shareToken).toBe(link.token);

    const joined = await req("bruno", "POST", "/masses/join", { token: link.token });
    expect(joined.json().mass).toMatchObject({ id: mass.id, access: "shared", shareToken: null });
    // Entrar de novo não duplica.
    await req("bruno", "POST", "/masses/join", { token: link.token });
    expect((await req("ana", "GET", `/masses/${mass.id}`)).json().mass.sharedWith).toHaveLength(1);
    // O dono abrindo o próprio link só recebe a missa.
    expect((await req("ana", "POST", "/masses/join", { token: link.token })).json().mass.access).toBe("owner");
  });

  it("só o dono gera ou desativa; link desativado deixa de funcionar, mas quem entrou continua", async () => {
    const mass = await createMass();
    const { token } = (await req("ana", "POST", `/masses/${mass.id}/share-link`)).json();
    await req("bruno", "POST", "/masses/join", { token });
    expect((await req("bruno", "POST", `/masses/${mass.id}/share-link`)).statusCode).toBe(403);
    expect((await req("bruno", "DELETE", `/masses/${mass.id}/share-link`)).statusCode).toBe(403);

    expect((await req("ana", "DELETE", `/masses/${mass.id}/share-link`)).statusCode).toBe(204);
    expect((await req("admin", "POST", "/masses/join", { token })).statusCode).toBe(404);
    expect((await req("bruno", "GET", `/masses/${mass.id}`)).statusCode).toBe(200);
    // Um novo link é outro token.
    expect((await req("ana", "POST", `/masses/${mass.id}/share-link`)).json().token).not.toBe(token);
  });

  it("entrar pelo link exige login", async () => {
    expect((await app.inject({ method: "POST", url: "/api/masses/join", payload: { token: "x".repeat(32) } })).statusCode).toBe(401);
  });

  it("missa com id do front (UUID) e canto inexistente", async () => {
    const id = "6f1c2b8e-4c5d-4e7f-9a1b-2c3d4e5f6a7b";
    expect((await req("ana", "POST", "/masses", { id, name: "Do front" })).json().mass.id).toBe(id);
    expect((await req("ana", "POST", "/masses", { id })).statusCode).toBe(409);
    const bad = await req("ana", "POST", "/masses", { slots: [{ id: "s", moment: "entrada", label: "Entrada", items: [{ songId: 999 }] }] });
    expect(bad.json().error.details.unknownSongIds).toEqual([999]);
  });
});

describe("Movimentos", () => {
  it("lista pública; criar, renomear e excluir só para admin", async () => {
    const create = await req("admin", "POST", "/admin/movements", { name: "Pastoral da Juventude" });
    expect(create.statusCode).toBe(201);
    const { id } = create.json().movement;

    expect((await app.inject({ method: "GET", url: "/api/movements" })).json().movements).toHaveLength(1);
    expect((await req("ana", "POST", "/admin/movements", { name: "Outro" })).statusCode).toBe(403);
    expect((await req("admin", "POST", "/admin/movements", { name: "pastoral da juventude" })).statusCode).toBe(409);

    expect((await req("admin", "PATCH", `/admin/movements/${id}`, { name: "PJ" })).json().movement.name).toBe("PJ");
    expect((await req("admin", "DELETE", `/admin/movements/${id}`)).statusCode).toBe(204);
  });

  it("cadastro com movimento existente; inexistente dá 400", async () => {
    const { id } = (await req("admin", "POST", "/admin/movements", { name: "Catequese" })).json().movement;
    const base = { name: "Carla Souza", password: "senha1234" };
    const ok = await app.inject({ method: "POST", url: "/api/users", payload: { ...base, email: "carla@x.com", movementId: id } });
    expect(ok.json().user.movement).toEqual({ id, name: "Catequese" });
    const bad = await app.inject({ method: "POST", url: "/api/users", payload: { ...base, email: "c2@x.com", movementId: 999 } });
    expect(bad.json().error.details.fields.movementId).toBe("Movimento não encontrado.");
  });
});
