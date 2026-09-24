import "server-only";
import songsJson from "@data/songs.json";
import categoriesJson from "@data/categories.json";
import type { Song, SongSummary, Taxonomy } from "@/lib/types";
import { lyricsOnly } from "@/lib/chords";

/**
 * Camada de acesso a dados. É o ÚNICO lugar que conhece a origem dos dados.
 * Fase 1: lê os JSONs de /data (na raiz do monorepo).
 * Fase 2: trocar a implementação por `fetch(`${process.env.API_URL}/songs`)`
 * mantendo as mesmas assinaturas — as páginas não mudam.
 */

const songs = songsJson as Song[];
const taxonomy = categoriesJson as Taxonomy;

export async function getSongs(): Promise<Song[]> {
  return songs;
}

export async function getSongBySlug(slug: string): Promise<Song | undefined> {
  return songs.find((s) => s.slug === slug);
}

export async function getTaxonomy(): Promise<Taxonomy> {
  return taxonomy;
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
  return songs.map(toSummary);
}
