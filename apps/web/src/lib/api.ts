"use client";

import { BASE_PATH } from "./routes";
import type { ApiFlag, ApiSong, FlagGroup } from "./apiSongs";

/**
 * Cliente da API (apps/api). Ligado quando o build tem API_URL (next.config injeta NEXT_PUBLIC_USE_API).
 * Sem ele (GitHub Pages), login e cadastro continuam no modo demonstração do store.ts.
 *
 * O front chama /api/* no próprio domínio e o Next repassa para a API (rewrite), então o cookie
 * do refresh é do mesmo site. O access token fica só em memória, nunca em localStorage.
 */
export const API_ENABLED = process.env.NEXT_PUBLIC_USE_API === "true";

export type ApiRole = "admin" | "musico";
export type ApiStatus = "pending" | "active" | "blocked";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  movement: { id: number; name: string } | null;
  status: ApiStatus;
  blockedReason: string | null;
  roles: ApiRole[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ApiPerson {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface ApiMass {
  id: string;
  name: string;
  date: string | null;
  time: string | null;
  season: string | null;
  year: string | null;
  slots: { id: string; moment: string; label: string; items: { songId: number; transpose: number }[] }[];
  owner: ApiPerson;
  sharedWith: ApiPerson[];
  access: "owner" | "shared";
  shareToken: string | null;
  updatedAt: string;
}

export type ApiMassBody = Pick<ApiMass, "name" | "date" | "time" | "season" | "year" | "slots">;

interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: ApiUser;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { reason?: string | null; fields?: Record<string, string> },
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
let accessExpiresAt = 0;
let refreshing: Promise<boolean> | null = null;

function keep(r: AuthResult) {
  accessToken = r.accessToken;
  // Renova 30 s antes de vencer.
  accessExpiresAt = Date.now() + (r.expiresIn - 30) * 1000;
  return r;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  // FormData (upload) define o próprio content-type com o boundary.
  const json = init.body && !(init.body instanceof FormData);
  try {
    res = await fetch(`${BASE_PATH}/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: { ...(json ? { "content-type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Sem conexão com o servidor. Verifique a internet e tente de novo.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error ?? {};
    throw new ApiError(res.status, e.code ?? "HTTP_" + res.status, e.message ?? "Erro inesperado. Tente de novo.", e.details);
  }
  return body as T;
}

/** Troca o cookie de refresh por um access token novo. Chamadas simultâneas compartilham a mesma troca. */
function refresh(): Promise<boolean> {
  refreshing ??= call<AuthResult>("/auth/refresh", { method: "POST" })
    .then((r) => (keep(r), true))
    .catch(() => {
      accessToken = null;
      return false;
    })
    .finally(() => (refreshing = null));
  return refreshing;
}

/** Chamada autenticada: renova o token se preciso e tenta de novo uma vez em caso de 401. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken || Date.now() >= accessExpiresAt) await refresh();
  const withToken = () => call<T>(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } });
  try {
    return await withToken();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && (await refresh())) return withToken();
    throw err;
  }
}

export const api = {
  async login(email: string, password: string, remember: boolean) {
    return keep(await call<AuthResult>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember }) })).user;
  },
  async logout() {
    accessToken = null;
    await call("/auth/logout", { method: "POST" }).catch(() => undefined);
  },
  async signup(data: { name: string; email: string; password: string; movementId: number | null; phone: string }) {
    return (await call<{ user: ApiUser }>("/users", { method: "POST", body: JSON.stringify(data) })).user;
  },
  async movements() {
    return (await call<{ movements: { id: number; name: string }[] }>("/movements")).movements;
  },
  async me() {
    return (await authed<{ user: ApiUser }>("/me")).user;
  },
  async searchPeople(q: string) {
    const r = await authed<{ users: (ApiPerson & { email: string; movement: string | null })[] }>(`/users/search?q=${encodeURIComponent(q)}&limit=20`);
    return r.users;
  },
  async uploadPhoto(file: File) {
    const body = new FormData();
    body.append("photo", file);
    return (await authed<{ user: ApiUser }>("/me/photo", { method: "PUT", body })).user;
  },
  admin: {
    users: async () => (await authed<{ users: ApiUser[] }>("/admin/users")).users,
    activate: async (id: string) => (await authed<{ user: ApiUser }>(`/admin/users/${id}/activate`, { method: "PATCH" })).user,
    songs: (q: { q?: string; flags?: number[]; page?: number; pageSize?: number } = {}) => {
      const sp = new URLSearchParams();
      if (q.q) sp.set("q", q.q);
      if (q.flags?.length) sp.set("flags", q.flags.join(","));
      sp.set("page", String(q.page ?? 1));
      sp.set("pageSize", String(q.pageSize ?? 50));
      return authed<{ songs: ApiSong[]; total: number; page: number; pageSize: number }>(`/admin/songs?${sp}`);
    },
    song: async (id: number) => (await authed<{ song: ApiSong }>(`/admin/songs/${id}`)).song,
    createSong: async (body: SongInput) => (await authed<{ song: ApiSong }>("/admin/songs", { method: "POST", body: JSON.stringify(body) })).song,
    updateSong: async (id: number, body: Partial<SongInput>) =>
      (await authed<{ song: ApiSong }>(`/admin/songs/${id}`, { method: "PATCH", body: JSON.stringify(body) })).song,
    deleteSong: (id: number) => authed<void>(`/admin/songs/${id}`, { method: "DELETE" }),
    uploadSongFile: async (id: number, kind: SongFileKind, file: File) => {
      const body = new FormData();
      body.append("file", file);
      return (await authed<{ song: ApiSong }>(`/admin/songs/${id}/files/${kind}`, { method: "PUT", body })).song;
    },
    removeSongFile: async (id: number, kind: SongFileKind) => (await authed<{ song: ApiSong }>(`/admin/songs/${id}/files/${kind}`, { method: "DELETE" })).song,
    flags: async () => (await call<{ flags: (ApiFlag & { songs: number })[] }>("/flags")).flags,
    createFlag: async (body: FlagInput) => (await authed<{ flag: ApiFlag }>("/admin/flags", { method: "POST", body: JSON.stringify(body) })).flag,
    updateFlag: async (id: number, body: FlagInput) => (await authed<{ flag: ApiFlag }>(`/admin/flags/${id}`, { method: "PUT", body: JSON.stringify(body) })).flag,
    deleteFlag: (id: number) => authed<void>(`/admin/flags/${id}`, { method: "DELETE" }),
    movements: async () => (await call<{ movements: { id: number; name: string; members: number }[] }>("/movements")).movements,
    createMovement: (name: string) => authed<unknown>("/admin/movements", { method: "POST", body: JSON.stringify({ name }) }),
    renameMovement: (id: number, name: string) => authed<unknown>(`/admin/movements/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    deleteMovement: (id: number) => authed<void>(`/admin/movements/${id}`, { method: "DELETE" }),
    publishSite: () => authed<{ ok: true }>("/admin/site/publish", { method: "POST" }),
  },
  masses: {
    list: async () => (await authed<{ masses: ApiMass[] }>("/masses")).masses,
    get: async (id: string) => (await authed<{ mass: ApiMass }>(`/masses/${id}`)).mass,
    create: async (id: string, body: ApiMassBody) => (await authed<{ mass: ApiMass }>("/masses", { method: "POST", body: JSON.stringify({ id, ...body }) })).mass,
    update: async (id: string, body: ApiMassBody) => (await authed<{ mass: ApiMass }>(`/masses/${id}`, { method: "PUT", body: JSON.stringify(body) })).mass,
    remove: (id: string) => authed<void>(`/masses/${id}`, { method: "DELETE" }),
    share: async (id: string, userIds: string[]) =>
      (await authed<{ mass: ApiMass }>(`/masses/${id}/shares`, { method: "PUT", body: JSON.stringify({ userIds }) })).mass,
    leave: (id: string) => authed<void>(`/masses/${id}/shares/me`, { method: "DELETE" }),
    createLink: (id: string) => authed<{ token: string; path: string }>(`/masses/${id}/share-link`, { method: "POST" }),
    revokeLink: (id: string) => authed<void>(`/masses/${id}/share-link`, { method: "DELETE" }),
    join: async (token: string) => (await authed<{ mass: ApiMass }>("/masses/join", { method: "POST", body: JSON.stringify({ token }) })).mass,
  },
};

export type SongFileKind = "cifra-pdf" | "partitura-pdf" | "audio";

export interface SongInput {
  number: number | null;
  slug?: string;
  title: string;
  composer: string | null;
  key: string | null;
  lyrics: string;
  media: { audio: string | null; audiomack: string | null; cifraPdf: string | null; partituraPdf: string | null };
  flagIds: number[];
  active: boolean;
}

export interface FlagInput {
  group: FlagGroup;
  slug: string;
  name: string;
  color: string | null;
  position: number;
}
