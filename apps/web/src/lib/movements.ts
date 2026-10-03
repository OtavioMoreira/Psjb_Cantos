"use client";

import { useEffect, useState } from "react";
import { api, API_ENABLED } from "./api";

export interface Movement {
  id: number;
  name: string;
}

/** Modo demonstração: mesma lista do seed da API (apps/api/src/database/seed.ts). */
export const DEMO_MOVEMENTS: Movement[] = [
  { id: 1, name: "Ministério de Música" },
  { id: 2, name: "Renovação Carismática Católica (RCC)" },
  { id: 3, name: "Pastoral da Juventude" },
  { id: 4, name: "Pastoral Familiar" },
  { id: 5, name: "Catequese" },
  { id: 6, name: "Legião de Maria" },
  { id: 7, name: "Equipes de Nossa Senhora (ENS)" },
  { id: 8, name: "Ministros Extraordinários da Comunhão" },
];

let cache: Promise<Movement[]> | null = null;

/** Lista de movimentos: da API quando ligada (buscada uma vez por página), senão a de demonstração. */
export function useMovements(): Movement[] {
  const [list, setList] = useState<Movement[]>(API_ENABLED ? [] : DEMO_MOVEMENTS);
  useEffect(() => {
    if (!API_ENABLED) return;
    cache ??= api.movements().catch(() => {
      cache = null; // tenta de novo na próxima tela
      return [];
    });
    let alive = true;
    cache.then((m) => alive && setList(m));
    return () => {
      alive = false;
    };
  }, []);
  return list;
}
