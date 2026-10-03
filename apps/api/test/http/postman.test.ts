import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { routes } from "../../src/routes/index.js";
import { makeTestContainer } from "../support/inMemory.js";

// A coleção do Postman (docs/postman) precisa acompanhar a API: toda rota tem pelo menos uma requisição,
// e toda requisição aponta para uma rota que existe.

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: { method: string; url: { path: string[] } };
}

const collection = JSON.parse(
  readFileSync(new URL("../../../../docs/postman/psjb-cantos.postman_collection.json", import.meta.url), "utf8"),
) as { item: PostmanItem[] };

const requests = (items: PostmanItem[]): { name: string; method: string; path: string }[] =>
  items.flatMap((i) =>
    i.item ? requests(i.item) : i.request ? [{ name: i.name, method: i.request.method, path: "/api/" + i.request.url.path.join("/") }] : [],
  );

async function apiRoutes() {
  const found: { method: string; url: string }[] = [];
  const app = Fastify();
  app.addHook("onRoute", (r) => {
    for (const method of [r.method].flat()) if (method !== "HEAD" && method !== "OPTIONS") found.push({ method, url: r.url });
  });
  await app.register(routes, { prefix: "/api", container: makeTestContainer().container });
  await app.ready();
  return found;
}

// /api/masses/:id casa com /api/masses/{{massId}}
const matches = (route: { method: string; url: string }, req: { method: string; path: string }) =>
  route.method === req.method && new RegExp("^" + route.url.replace(/:[^/]+/g, "[^/]+") + "$").test(req.path);

describe("Coleção do Postman", () => {
  it("cobre todas as rotas da API e não tem rota inexistente", async () => {
    const all = await apiRoutes();
    const reqs = requests(collection.item);
    const missing = all.filter((r) => !reqs.some((q) => matches(r, q))).map((r) => `${r.method} ${r.url}`);
    const stale = reqs.filter((q) => !all.some((r) => matches(r, q))).map((q) => `${q.method} ${q.path} (${q.name})`);
    expect(missing, "rotas sem requisição no Postman").toEqual([]);
    expect(stale, "requisições do Postman sem rota").toEqual([]);
  });
});
