"use client";

import { useMemo, useSyncExternalStore } from "react";
import defaultUser from "@data/user.json";
import type { Mass, MassSlot, MomentId, User } from "./types";
import { liturgicalSeason, liturgicalYear, nextSundayIso } from "./liturgy";

/**
 * Estado do cliente (Fase 1, sem API): sessão ilustrativa, perfil e missas em localStorage.
 * Na Fase 3 isto vira chamadas à API (cookie httpOnly + /api/me, /api/masses).
 */

type Listener = () => void;

function createStore<T>(key: string, fallback: T) {
  const listeners = new Set<Listener>();
  let cache: T | undefined;

  function read(): T {
    if (cache !== undefined) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      cache = fallback;
    }
    return cache;
  }

  function write(value: T) {
    cache = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* armazenamento indisponível: mantém em memória */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(l: Listener) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        cache = undefined;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, read, () => fallback);
  }

  return { read, write, useValue };
}

/* ---------------- Sessão e usuário ---------------- */

const DEMO_PASSWORD = defaultUser.password;
const seedUser: User = {
  id: defaultUser.id,
  name: defaultUser.name,
  email: defaultUser.email,
  role: defaultUser.role,
  ministry: defaultUser.ministry,
  parish: defaultUser.parish,
};
export const DEMO_EMAIL = defaultUser.email;
export { DEMO_PASSWORD };

interface Session {
  loggedIn: boolean;
}

const sessionStore = createStore<Session>("psjb:session", { loggedIn: false });
const userStore = createStore<User & { password: string }>("psjb:user", {
  ...seedUser,
  instrument: "Violão",
  password: DEMO_PASSWORD,
});

export const useSession = sessionStore.useValue;

export function useUser(): User {
  const u = userStore.useValue();
  return useMemo(() => {
    const user: User & { password?: string } = { ...u };
    delete user.password;
    return user;
  }, [u]);
}

export function login(email: string, password: string) {
  const u = userStore.read();
  const ok = email.trim().toLowerCase() === u.email.toLowerCase() && password === u.password;
  if (ok) sessionStore.write({ loggedIn: true });
  return ok;
}

export function logout() {
  sessionStore.write({ loggedIn: false });
}

export function updateUser(patch: Partial<User>) {
  userStore.write({ ...userStore.read(), ...patch });
}

export function changePassword(current: string, next: string) {
  const u = userStore.read();
  if (u.password !== current) return false;
  userStore.write({ ...u, password: next });
  return true;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/* ---------------- Preferências ---------------- */

export interface Prefs {
  fontSize: number;
  massFontSize: number;
  preferFlats: boolean;
  theme: "light" | "dark" | "system";
  massPalette: "dia" | "noite" | "sepia";
}

const prefsStore = createStore<Prefs>("psjb:prefs", {
  fontSize: 16,
  massFontSize: 24,
  preferFlats: false,
  theme: "light",
  massPalette: "dia",
});
export const usePrefs = prefsStore.useValue;
export function setPrefs(patch: Partial<Prefs>) {
  prefsStore.write({ ...prefsStore.read(), ...patch });
  if (patch.theme) applyTheme(patch.theme);
}

export function applyTheme(theme: Prefs["theme"]) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/* ---------------- Missas ---------------- */

export const DEFAULT_SLOTS: { moment: MomentId; label: string }[] = [
  { moment: "velas", label: "Velas" },
  { moment: "entrada", label: "Entrada" },
  { moment: "ato-penitencial", label: "Ato Penitencial" },
  { moment: "gloria", label: "Glória" },
  { moment: "salmo", label: "Salmo" },
  { moment: "aclamacao", label: "Aclamação" },
  { moment: "preces", label: "Preces da Comunidade" },
  { moment: "ofertorio", label: "Ofertório" },
  { moment: "comunhao", label: "Comunhão" },
  { moment: "saida", label: "Saída" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function seedMasses(): Mass[] {
  const date = nextSundayIso();
  const d = new Date(date + "T12:00:00");
  const picks: Partial<Record<MomentId, number>> = {
    velas: 458,
    entrada: 77,
    "ato-penitencial": 141,
    gloria: 157,
    salmo: 214,
    aclamacao: 215,
    preces: 605,
    ofertorio: 189,
    comunhao: 382,
  };
  return [
    {
      id: "exemplo",
      name: "Domingo — Missa das 19h",
      date,
      time: "19:00",
      season: liturgicalSeason(d),
      year: liturgicalYear(d),
      updatedAt: new Date().toISOString(),
      slots: DEFAULT_SLOTS.map((s) => ({
        id: uid(),
        ...s,
        items: picks[s.moment] ? [{ songId: picks[s.moment]!, transpose: 0 }] : [],
      })),
    },
  ];
}

const massesStore = createStore<Mass[] | null>("psjb:masses", null);

export function useMasses(): Mass[] {
  const v = massesStore.useValue();
  return v ?? SEED;
}
const SEED = seedMasses();

function allMasses() {
  return massesStore.read() ?? SEED;
}

export function getMass(id: string) {
  return allMasses().find((m) => m.id === id);
}

export function newMass(): Mass {
  const date = nextSundayIso();
  const d = new Date(date + "T12:00:00");
  return {
    id: uid(),
    name: "",
    date,
    time: "10:00",
    season: liturgicalSeason(d),
    year: liturgicalYear(d),
    updatedAt: new Date().toISOString(),
    slots: DEFAULT_SLOTS.map((s) => ({ id: uid(), ...s, items: [] })),
  };
}

export function saveMass(mass: Mass) {
  const list = allMasses();
  const next = { ...mass, updatedAt: new Date().toISOString() };
  const i = list.findIndex((m) => m.id === mass.id);
  massesStore.write(i >= 0 ? list.map((m) => (m.id === mass.id ? next : m)) : [next, ...list]);
  return next;
}

export function deleteMass(id: string) {
  const list = allMasses();
  const removed = list.find((m) => m.id === id);
  massesStore.write(list.filter((m) => m.id !== id));
  return removed;
}

export function duplicateMass(id: string) {
  const m = getMass(id);
  if (!m) return;
  const copy: Mass = {
    ...structuredClone(m),
    id: uid(),
    name: `Cópia de ${m.name || "missa"}`,
    date: "",
  };
  return saveMass(copy);
}

export function addSongToMass(massId: string, moment: MomentId, songId: number) {
  const m = getMass(massId);
  if (!m) return;
  const slots: MassSlot[] = m.slots.some((s) => s.moment === moment)
    ? m.slots.map((s) =>
        s.moment === moment && !s.items.some((i) => i.songId === songId)
          ? { ...s, items: [...s.items, { songId, transpose: 0 }] }
          : s,
      )
    : [...m.slots, { id: uid(), moment, label: moment, items: [{ songId, transpose: 0 }] }];
  saveMass({ ...m, slots });
}

export { uid };
