"use client";

import { useMemo, useSyncExternalStore } from "react";
import usersJson from "@data/users.json";
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

/* ---------------- Usuários e sessão ---------------- */

type StoredUser = User & { password: string; token?: string | null };

/** Contas de demonstração exibidas na tela de login. */
export const DEMO_ACCOUNTS = [
  { label: "Administrador", email: "admin@psjb.org.br", password: "admin123" },
  { label: "Músico", email: "musica@psjb.org.br", password: "cantos123" },
];

const usersStore = createStore<StoredUser[]>("psjb:users", usersJson as StoredUser[]);
const sessionStore = createStore<{ userId: string | null }>("psjb:session", { userId: null });

const now = () => new Date().toISOString();
const token = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const strip = ({ password: _p, token: _t, ...u }: StoredUser): User => u; // eslint-disable-line @typescript-eslint/no-unused-vars

function writeUser(id: string, patch: Partial<StoredUser>) {
  usersStore.write(usersStore.read().map((u) => (u.id === id ? { ...u, ...patch } : u)));
}

export function useUsers(): User[] {
  const list = usersStore.useValue();
  return useMemo(() => list.map(strip), [list]);
}

export function useSession() {
  const { userId } = sessionStore.useValue();
  const list = usersStore.useValue();
  const user = list.find((u) => u.id === userId);
  const loggedIn = Boolean(user && user.status === "ativo");
  return { loggedIn, userId: loggedIn ? userId : null };
}

const GUEST: User = {
  id: "",
  name: "Visitante",
  email: "",
  role: "musico",
  status: "ativo",
  ministry: "",
  parish: "",
  createdAt: "",
  emailVerifiedAt: null,
  lastLoginAt: null,
};

export function useUser(): User {
  const { userId } = sessionStore.useValue();
  const list = usersStore.useValue();
  return useMemo(() => {
    const u = list.find((x) => x.id === userId);
    return u ? strip(u) : GUEST;
  }, [list, userId]);
}

export function useIsAdmin() {
  const user = useUser();
  const { loggedIn } = useSession();
  return loggedIn && user.role === "admin";
}

export type LoginResult = { ok: true } | { ok: false; reason: "credenciais" | "pendente" | "bloqueado"; message?: string };

export function login(email: string, password: string): LoginResult {
  const u = usersStore.read().find((x) => sameEmail(x.email, email));
  if (!u || u.password !== password) return { ok: false, reason: "credenciais" };
  if (u.status === "pendente") return { ok: false, reason: "pendente" };
  if (u.status === "bloqueado") return { ok: false, reason: "bloqueado", message: u.blockedReason };
  writeUser(u.id, { lastLoginAt: now() });
  sessionStore.write({ userId: u.id });
  return { ok: true };
}

export function logout() {
  sessionStore.write({ userId: null });
}

export function updateUser(patch: Partial<User>) {
  const { userId } = sessionStore.read();
  if (userId) writeUser(userId, patch);
}

export function changePassword(current: string, next: string) {
  const { userId } = sessionStore.read();
  const u = usersStore.read().find((x) => x.id === userId);
  if (!u || u.password !== current) return false;
  writeUser(u.id, { password: next });
  return true;
}

/* Cadastro com confirmação de e-mail — Fase 3: POST /api/auth/signup + e-mail com token */

export function signup(data: { name: string; email: string; password: string; ministry: string }) {
  if (usersStore.read().some((u) => sameEmail(u.email, data.email))) return { ok: false as const, reason: "existe" as const };
  const t = token();
  const user: StoredUser = {
    id: "u-" + uid(),
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    role: "musico",
    status: "pendente",
    ministry: data.ministry.trim(),
    parish: "Paróquia Catedral São João Batista",
    createdAt: now(),
    emailVerifiedAt: null,
    lastLoginAt: null,
    token: t,
  };
  usersStore.write([...usersStore.read(), user]);
  return { ok: true as const, token: t };
}

/** Reenvia (simula) o e-mail de confirmação. Devolve o token só para a demonstração. */
export function resendVerification(email: string) {
  const u = usersStore.read().find((x) => sameEmail(x.email, email) && x.status === "pendente");
  if (!u) return null;
  const t = token();
  writeUser(u.id, { token: t });
  return t;
}

export function verifyEmail(t: string): "ok" | "invalido" {
  const u = usersStore.read().find((x) => x.token && x.token === t);
  if (!u) return "invalido";
  writeUser(u.id, { status: u.status === "pendente" ? "ativo" : u.status, emailVerifiedAt: now(), token: null });
  return "ok";
}

/* Recuperação de senha — Fase 3: POST /api/auth/forgot e /api/auth/reset */

export function requestPasswordReset(email: string) {
  const u = usersStore.read().find((x) => sameEmail(x.email, email));
  if (!u) return null; // a UI responde igual nos dois casos (não revela se o e-mail existe)
  const t = token();
  writeUser(u.id, { token: t });
  return t;
}

export function resetPassword(t: string, password: string) {
  const u = usersStore.read().find((x) => x.token && x.token === t);
  if (!u) return false;
  writeUser(u.id, { password, token: null });
  return true;
}

/* Administração — Fase 3: /api/admin/users (somente papel admin) */

export const admin = {
  update(id: string, patch: Partial<Pick<User, "name" | "email" | "role" | "ministry">>) {
    writeUser(id, patch);
  },
  block(id: string, reason: string) {
    writeUser(id, { status: "bloqueado", blockedReason: reason.trim() || undefined });
  },
  unblock(id: string) {
    const u = usersStore.read().find((x) => x.id === id);
    writeUser(id, { status: u?.emailVerifiedAt ? "ativo" : "pendente", blockedReason: undefined });
  },
  activate(id: string) {
    writeUser(id, { status: "ativo", emailVerifiedAt: now(), token: null });
  },
  resendVerification(id: string) {
    writeUser(id, { token: token() });
  },
  sendResetLink(id: string) {
    writeUser(id, { token: token() });
  },
  /** Gera uma senha temporária (a pessoa deve trocar no primeiro acesso). */
  temporaryPassword(id: string) {
    const pwd = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 6);
    writeUser(id, { password: pwd });
    return pwd;
  },
  invite(data: { name: string; email: string; role: User["role"] }) {
    if (usersStore.read().some((u) => sameEmail(u.email, data.email))) return false;
    usersStore.write([
      ...usersStore.read(),
      {
        id: "u-" + uid(),
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        password: token().slice(0, 10),
        role: data.role,
        status: "pendente",
        ministry: "",
        parish: "Paróquia Catedral São João Batista",
        createdAt: now(),
        emailVerifiedAt: null,
        lastLoginAt: null,
        token: token(),
      },
    ]);
    return true;
  },
  remove(id: string) {
    const list = usersStore.read();
    const removed = list.find((u) => u.id === id);
    usersStore.write(list.filter((u) => u.id !== id));
    return () => removed && usersStore.write([...usersStore.read(), removed]);
  },
};

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
  /** Modo Missa: false = só a letra (para quem canta). */
  massShowChords: boolean;
}

const prefsStore = createStore<Prefs>("psjb:prefs", {
  fontSize: 16,
  massFontSize: 24,
  preferFlats: false,
  theme: "light",
  massPalette: "dia",
  massShowChords: true,
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
