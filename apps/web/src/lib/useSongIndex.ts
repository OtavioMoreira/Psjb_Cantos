"use client";

import { useEffect, useState } from "react";
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
