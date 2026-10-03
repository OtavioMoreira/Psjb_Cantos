import "server-only";
import songsJson from "@data/songs.json";
import categoriesJson from "@data/categories.json";
import type { Song, SongSummary, Taxonomy } from "@/lib/types";
import { lyricsOnly } from "@/lib/chords";
import { toSong, toTaxonomy, type ApiFlag, type ApiSong } from "@/lib/apiSongs";

/**
 * Camada de acesso a dados. É o ÚNICO lugar que conhece a origem dos dados.
 * - Sem API_URL (GitHub Pages): lê os JSONs de /data.
 * - Com API_URL: busca na API (no build, para as páginas estáticas; no `next dev`, a cada minuto).
 * As assinaturas são as mesmas: as páginas não mudam.
 */

const API = (process.env.API_URL ?? "").replace(/\/+$/, "");
const fromJson = { songs: songsJson as Song[], taxonomy: categoriesJson as Taxonomy };

let cache: { at: number; data: Promise<typeof fromJson> } | null = null;

// Carimbo deste build: na Vercel o cache de fetch do Next sobrevive entre deploys, então cada
// "Publicar no site" precisa de URLs novas para não reaproveitar os cantos do build anterior.
const BUILD = Date.now().toString(36);

async function getJson<T>(path: string): Promise<T> {
  // No build, "force-cache" deixa as páginas estáticas (o site muda com "Publicar no site").
  // "no-store" tornaria cada visita uma chamada à API. No next dev, os dados ficam frescos.
  const url = `${API}/api${path}${path.includes("?") ? "&" : "?"}build=${BUILD}`;
  const res = await fetch(url, { cache: process.env.NODE_ENV === "development" ? "no-store" : "force-cache" });
  if (!res.ok) throw new Error(`API ${path} respondeu ${res.status}`);
  return res.json() as Promise<T>;
}

/** Todos os cantos ativos com a letra (paginado de 200 em 200) e as flags. */
async function fromApi() {
  const songs: ApiSong[] = [];
  for (let page = 1; ; page++) {
    const r = await getJson<{ songs: ApiSong[]; total: number }>(`/songs?full=1&pageSize=200&page=${page}`);
    songs.push(...r.songs);
    if (songs.length >= r.total || r.songs.length === 0) break;
  }
  const { flags } = await getJson<{ flags: ApiFlag[] }>("/flags");
  return { songs: songs.map(toSong), taxonomy: toTaxonomy(flags) };
}

function load() {
  if (!API) return Promise.resolve(fromJson);
  // Um minuto de cache: no build é uma busca só; no next dev, não martela a API a cada página.
  if (!cache || Date.now() - cache.at > 60_000) {
    cache = { at: Date.now(), data: fromApi() };
    cache.data.catch(() => (cache = null));
  }
  return cache.data;
}

export async function getSongs(): Promise<Song[]> {
  return (await load()).songs;
}

export async function getSongBySlug(slug: string): Promise<Song | undefined> {
  return (await load()).songs.find((s) => s.slug === slug);
}

export async function getTaxonomy(): Promise<Taxonomy> {
  return (await load()).taxonomy;
}

export function toSummary(song: Song): SongSummary {
  const { lyrics, media, ...rest } = song;
  const text = lyricsOnly(lyrics).replace(/\s+/g, " ").trim();
  return {
    ...rest,
    has: {
      cifra: Boolean(lyrics || media.cifraPdf),
      partitura: Boolean(media.partituraPdf),
      audio: Boolean(media.audio || media.audiomack),
    },
    excerpt: text.slice(0, 120),
  };
}

export async function getSongSummaries(): Promise<SongSummary[]> {
  return (await load()).songs.map(toSummary);
}
