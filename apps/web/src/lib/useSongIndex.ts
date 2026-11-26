"use client";

import { useEffect, useMemo, useState } from "react";
import type { Song } from "./types";
import { BASE_PATH } from "./routes";

let cache: Promise<Song[]> | null = null;

export function loadSongIndex() {
  cache ??= fetch(`${BASE_PATH}/dados/cantos.json`).then((r) => {
    if (!r.ok) throw new Error("Falha ao carregar cantos");
    return r.json() as Promise<Song[]>;
  });
  cache.catch(() => (cache = null));
  return cache;
}

/** Carrega (uma única vez, sob demanda) o índice completo de cantos. */
export function useSongIndex(enabled = true) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadSongIndex()
      .then((s) => alive && setSongs(s))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { songs, error };
}

/* Cantos que a missa usa mas ainda não estão no índice do site (o índice é gerado no build):
 * aprovados e não publicados, ou ocultos (só o admin vê). Busca cada um uma vez na API. */
const fetched = new Map<number, Promise<Song | null>>();

export function fetchSong(id: number): Promise<Song | null> {
  let p = fetched.get(id);
  if (!p) {
    p = import("./api").then(async ({ api, API_ENABLED }) => {
      if (!API_ENABLED) return null;
      const { toSong } = await import("./apiSongs");
      // Visível pela rota pública; oculto, só pela do admin (para os outros, fica sem nome).
      const s = await api.song(id).catch(() => api.admin.song(id).catch(() => null));
      return s ? { ...toSong(s), hidden: !s.active } : null;
    });
    fetched.set(id, p);
  }
  return p;
}

/**
 * Índice do site + os cantos que faltam nele (pela API). `byId` já traz todos que deu para achar;
 * `pending(id)` diz se ainda está buscando (para mostrar "Carregando…" e não "sem nome").
 */
export function useSongMap(ids: number[], enabled = true) {
  const { songs, error } = useSongIndex(enabled);
  const [extra, setExtra] = useState<Record<number, Song | null>>({});
  const key = [...new Set(ids)].sort((a, b) => a - b).join(",");
  useEffect(() => {
    if (!songs || !key) return;
    const known = new Set(songs.map((s) => s.id));
    const missing = key.split(",").map(Number).filter((id) => !known.has(id));
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map(async (id) => [id, await fetchSong(id)] as const)).then((found) => alive && setExtra((prev) => ({ ...prev, ...Object.fromEntries(found) })));
    return () => {
      alive = false;
    };
  }, [songs, key]);
  const byId = useMemo(() => {
    const m = new Map((songs ?? []).map((s) => [s.id, s]));
    for (const [id, s] of Object.entries(extra)) if (s) m.set(Number(id), s);
    return m;
  }, [songs, extra]);
  const pending = (id: number) => !byId.has(id) && (!songs || !(id in extra));
  return { songs, byId, error, pending };
}
