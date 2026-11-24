// Service worker do Cantos PSJB: o Modo Missa abre e funciona sem internet (regras §8).
// Estratégias:
//   páginas (navegação)      → rede primeiro; sem rede, a última cópia (o site nunca fica preso numa versão velha);
//   /_next/static/*          → cache primeiro (os nomes têm hash, nunca mudam);
//   /dados/cantos.json       → cópia na hora e atualização em segundo plano;
//   /api/*, áudios e PDFs    → nunca guardados (dados pessoais e arquivos grandes).
// Ao abrir uma missa, a página manda {type: "cache-urls"} com o que ela usou, para tudo ficar guardado.

const VERSION = "v1";
const PAGES = `psjb-pages-${VERSION}`;
const ASSETS = `psjb-assets-${VERSION}`;
const DATA = `psjb-data-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, ASSETS, DATA];
      for (const name of await caches.keys()) if (name.startsWith("psjb-") && !keep.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

const isAsset = (url) => url.pathname.startsWith(`${BASE}/_next/static/`);
const isIndex = (url) => url.pathname === `${BASE}/dados/cantos.json`;
const isPrivate = (url) => url.pathname.startsWith(`${BASE}/api/`) || /\.(mp3|m4a|ogg|pdf)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || isPrivate(url)) return;

  if (req.mode === "navigate") return event.respondWith(networkFirst(req));
  if (isAsset(url)) return event.respondWith(cacheFirst(req, ASSETS));
  if (isIndex(url)) return event.respondWith(staleWhileRevalidate(req, DATA));
});

async function networkFirst(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(pageKey(req.url), res.clone());
    return res;
  } catch {
    // A missa abre por /missa?id=…: a página é a mesma para todas, o id é lido no navegador.
    const hit = await cache.match(pageKey(req.url));
    if (hit) return hit;
    throw new Error("sem conexão e sem cópia");
  }
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then(async (res) => {
      if (res.ok) await cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit ?? (await fresh) ?? Response.error();
}

/** Página sem a query string (?id=) e sem a barra final: uma cópia por rota. */
function pageKey(href) {
  const u = new URL(href);
  return `${u.origin}${u.pathname.replace(/\/$/, "") || "/"}`;
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-urls") return;
  const urls = (event.data.urls ?? []).filter((u) => typeof u === "string");
  event.waitUntil(
    (async () => {
      for (const href of urls) {
        const url = new URL(href, self.location.origin);
        if (url.origin !== self.location.origin || isPrivate(url)) continue;
        const name = isAsset(url) ? ASSETS : isIndex(url) ? DATA : PAGES;
        const key = name === PAGES ? pageKey(url.href) : url.href;
        const cache = await caches.open(name);
        if (name === ASSETS && (await cache.match(key))) continue;
        try {
          const res = await fetch(url.href, { credentials: "same-origin" });
          if (res.ok) await cache.put(key, res);
        } catch {
          // Sem rede agora: fica para a próxima vez que a missa for aberta.
        }
      }
      event.source?.postMessage({ type: "cached" });
    })(),
  );
});
