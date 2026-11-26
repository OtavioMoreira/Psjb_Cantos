"use client";

import type { MassScript } from "./types";
import type { AuditEntry, AuditTarget } from "./audit";
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

/** "Há alterações não publicadas" (cantos e flags mudaram depois do último "Publicar no site"). */
export interface ApiSiteStatus {
  enabled: boolean;
  pending: boolean;
  contentChangedAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface ApiUserPage {
  users: ApiUser[];
  total: number;
  page: number;
  pageSize: number;
  counts: { all: number; pending: number; active: number; blocked: number };
}

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  movements: { id: number; name: string }[];
  parish: string | null;
  instrument: string | null;
  status: ApiStatus;
  blockedReason: string | null;
  roles: ApiRole[];
  /** Senha temporária gerada pelo admin: precisa trocar antes de usar o painel. */
  mustChangePassword: boolean;
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
  /** Sugerida por um admin para todos na semana da data. */
  suggested: boolean;
  script: MassScript | null;
  owner: ApiPerson;
  sharedWith: ApiPerson[];
  /** "suggestion": a pessoa só vê a sugestão da semana (sem editar). */
  access: "owner" | "shared" | "suggestion";
  shareToken: string | null;
  /** Vai de volta no If-Match: se outra pessoa salvou antes, a API responde 409 MASS_CONFLICT. */
  version: number;
  updatedBy: ApiPerson | null;
  updatedAt: string;
}

export type ApiMassBody = Pick<ApiMass, "name" | "date" | "time" | "season" | "year" | "slots" | "suggested" | "script">;

/** Senha certa com o 2FA ligado: falta o código enviado por e-mail. */
export interface LoginChallenge {
  twoFactor: true;
  challengeId: string;
  emailHint: string;
  expiresIn: number;
}

interface AuthResult {
  accessToken: string;
  expiresIn: number;
  user: ApiUser;
}

export type ImportStatus = "created" | "linked" | "review" | "ignored" | "failed";
export interface ApiImportItem {
  id: number;
  title: string;
  kind: "salmo" | "aclamacao";
  celebrationDate: string;
  pdfUrl: string | null;
  audioUrl: string | null;
  status: ImportStatus;
  songId: number | null;
  candidateSongIds: number[];
  message: string | null;
  updatedAt: string;
}
export interface ApiImportRun {
  id: number;
  trigger: "cron" | "manual";
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, number>;
  error: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { reason?: string | null; fields?: Record<string, string>; attemptsLeft?: number; retryAfter?: number; mass?: ApiMass; captcha?: boolean },
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

/** Disparado quando o admin muda cantos ou flags: o botão "Publicar no site" confere o status de novo. */
/** Acima disso, o arquivo de canto vai direto para o Blob (ver uploadSongFile). */
export const SERVER_UPLOAD_MAX = 4 * 1024 * 1024;
/** Teto do envio direto (igual ao da API). */
export const DIRECT_UPLOAD_MAX = 25 * 1024 * 1024;

/** Tipo pelo nome quando o navegador não informa (ou informa "audio/mp3"). A API confere os bytes de qualquer jeito. */
function fileContentType(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = { pdf: "application/pdf", mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg" };
  return byExt[ext ?? ""] ?? (file.type === "audio/mp3" ? "audio/mpeg" : file.type);
}

export const SITE_CONTENT_EVENT = "psjb:site-content-changed";
const changesSiteContent = (path: string, method = "GET") => method !== "GET" && /^\/admin\/(songs|flags|imports)\b/.test(path);

/** Chamada autenticada: renova o token se preciso e tenta de novo uma vez em caso de 401. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken || Date.now() >= accessExpiresAt) await refresh();
  const withToken = () => call<T>(path, { ...init, headers: { ...init.headers, authorization: `Bearer ${accessToken}` } });
  let result: T;
  try {
    result = await withToken();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401 && (await refresh()))) throw err;
    result = await withToken();
  }
  if (changesSiteContent(path, init.method)) window.dispatchEvent(new Event(SITE_CONTENT_EVENT));
  return result;
}

export const api = {
  /** Devolve o usuário (sessão aberta) ou o desafio do 2FA, quando o código ainda precisa ser digitado. */
  async login(email: string, password: string, remember: boolean, captchaToken?: string): Promise<{ user: ApiUser } | { challenge: LoginChallenge }> {
    const r = await call<AuthResult | LoginChallenge>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember, captchaToken }) });
    if ("twoFactor" in r) return { challenge: r };
    return { user: keep(r).user };
  },
  /** Segunda etapa: o código de 6 dígitos. `trustDevice` dispensa o código neste aparelho por 30 dias. */
  async verifyLoginCode(challengeId: string, code: string, trustDevice: boolean) {
    return keep(await call<AuthResult>("/auth/login/verify", { method: "POST", body: JSON.stringify({ challengeId, code, trustDevice }) })).user;
  },
  resendLoginCode: (challengeId: string) => call<LoginChallenge>("/auth/login/resend", { method: "POST", body: JSON.stringify({ challengeId }) }),
  async logout() {
    accessToken = null;
    await call("/auth/logout", { method: "POST" }).catch(() => undefined);
  },
  async signup(data: { name: string; email: string; password: string; movementIds: number[]; phone: string; captchaToken?: string }) {
    return (await call<{ user: ApiUser }>("/users", { method: "POST", body: JSON.stringify(data) })).user;
  },
  /** Sempre responde igual, exista ou não a conta. */
  forgotPassword: (email: string, captchaToken?: string) => call<{ ok: true }>("/auth/forgot", { method: "POST", body: JSON.stringify({ email, captchaToken }) }),
  /** Link de redefinição ou de convite. INVALID_TOKEN se o link venceu ou já foi usado. */
  /** `movementIds` só vale no convite: somam aos movimentos que o admin já marcou. */
  resetPassword: (token: string, password: string, movementIds: number[] = []) =>
    call<{ email: string }>("/auth/reset", { method: "POST", body: JSON.stringify({ token, password, movementIds }) }),
  /** Pede a troca do próprio e-mail: o link vai para o endereço novo. */
  requestEmailChange: (email: string, password: string) => authed<{ ok: true }>("/me/email", { method: "POST", body: JSON.stringify({ email, password }) }),
  /** Confirma pelo link do e-mail (não precisa estar logado). */
  confirmEmailChange: (token: string) => call<{ email: string }>("/auth/confirm-email", { method: "POST", body: JSON.stringify({ token }) }),
  /** Um canto visível pelo id ou slug (mesmo antes de "Publicar no site"). */
  song: async (ref: number | string) => (await call<{ song: ApiSong }>(`/songs/${ref}`)).song,
  async movements() {
    return (await call<{ movements: { id: number; name: string }[] }>("/movements")).movements;
  },
  async me() {
    return (await authed<{ user: ApiUser }>("/me")).user;
  },
  async searchPeople(q: string) {
    const r = await authed<{ users: (ApiPerson & { email: string; movements: string[] })[] }>(`/users/search?q=${encodeURIComponent(q)}&limit=20`);
    return r.users;
  },
  async updateMe(body: ProfileInput) {
    return (await authed<{ user: ApiUser }>("/me", { method: "PATCH", body: JSON.stringify(body) })).user;
  },
  /** Fica em /auth para o cookie ir junto: a sessão deste aparelho continua e as outras caem. */
  async changePassword(currentPassword: string, newPassword: string) {
    return (await authed<{ user: ApiUser }>("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) })).user;
  },
  async uploadPhoto(file: File) {
    const body = new FormData();
    body.append("photo", file);
    return (await authed<{ user: ApiUser }>("/me/photo", { method: "PUT", body })).user;
  },
  admin: {
    /** Uma página da lista (pendentes primeiro), o total com os filtros e o resumo por status de todas as contas. */
    users: (q: { q?: string; status?: ApiUser["status"]; role?: ApiUser["roles"][number]; page?: number; pageSize?: number } = {}) => {
      const sp = new URLSearchParams();
      if (q.q) sp.set("q", q.q);
      if (q.status) sp.set("status", q.status);
      if (q.role) sp.set("role", q.role);
      sp.set("page", String(q.page ?? 1));
      sp.set("pageSize", String(q.pageSize ?? 50));
      return authed<ApiUserPage>(`/admin/users?${sp}`);
    },
    activate: async (id: string) => (await authed<{ user: ApiUser }>(`/admin/users/${id}/activate`, { method: "PATCH" })).user,
    updateUser: async (id: string, body: AdminUserInput) =>
      (await authed<{ user: ApiUser }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) })).user,
    block: async (id: string, reason: string | null) =>
      (await authed<{ user: ApiUser }>(`/admin/users/${id}/block`, { method: "POST", body: JSON.stringify({ reason }) })).user,
    unblock: async (id: string) => (await authed<{ user: ApiUser }>(`/admin/users/${id}/unblock`, { method: "POST" })).user,
    invite: async (body: { name: string; email: string; roles: ApiRole[] }) =>
      (await authed<{ user: ApiUser }>("/admin/users/invite", { method: "POST", body: JSON.stringify(body) })).user,
    inviteBulk: async (body: { people: { name: string; email: string }[]; roles: ApiRole[] }) =>
      (
        await authed<{ results: { name: string; email: string; status: "invited" | "exists" | "email_failed"; user: ApiUser | null }[] }>(
          "/admin/users/invite/bulk",
          { method: "POST", body: JSON.stringify(body) },
        )
      ).results,
    resendInvite: (id: string) => authed<{ ok: true }>(`/admin/users/${id}/invite`, { method: "POST" }),
    sendResetLink: (id: string) => authed<{ ok: true }>(`/admin/users/${id}/reset-link`, { method: "POST" }),
    resetPassword: (id: string) => authed<{ user: ApiUser; temporaryPassword: string }>(`/admin/users/${id}/reset-password`, { method: "POST" }),
    deleteUser: (id: string) => authed<void>(`/admin/users/${id}`, { method: "DELETE" }),
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
    /**
     * Até 4 MB, o arquivo passa pela API (limite do corpo das Functions da Vercel). Acima disso, vai
     * direto do navegador para o Blob com um token de uso único, e a API só confere e liga ao canto.
     */
    uploadSongFile: async (id: number, kind: SongFileKind, file: File, onProgress?: (percent: number) => void) => {
      if (file.size <= SERVER_UPLOAD_MAX) {
        const body = new FormData();
        body.append("file", file);
        return (await authed<{ song: ApiSong }>(`/admin/songs/${id}/files/${kind}`, { method: "PUT", body })).song;
      }
      const contentType = fileContentType(file);
      const ticket = await authed<{ mode: "server"; maxBytes: number } | { mode: "direct"; token: string; pathname: string; maxBytes: number }>(
        `/admin/songs/${id}/files/${kind}/upload`,
        { method: "POST", body: JSON.stringify({ contentType, size: file.size }) },
      );
      if (ticket.mode === "server") throw new ApiError(415, "INVALID_FILE", `O arquivo pode ter no máximo ${ticket.maxBytes / 1024 / 1024} MB.`);
      // Biblioteca do Blob só quando precisa (arquivo grande, no admin).
      const { put } = await import("@vercel/blob/client");
      const blob = await put(ticket.pathname, file, {
        access: "public",
        token: ticket.token,
        contentType,
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: (e) => onProgress?.(Math.round(e.percentage)),
      }).catch(() => {
        throw new ApiError(0, "UPLOAD_FAILED", "O envio do arquivo falhou. Confira a conexão e tente de novo.");
      });
      return (await authed<{ song: ApiSong }>(`/admin/songs/${id}/files/${kind}/blob`, { method: "PUT", body: JSON.stringify({ url: blob.url }) })).song;
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
    publishSite: async () => (await authed<{ ok: true; status: ApiSiteStatus }>("/admin/site/publish", { method: "POST" })).status,
    audit: (q: { targetType?: AuditTarget; page?: number; pageSize?: number } = {}) => {
      const sp = new URLSearchParams();
      if (q.targetType) sp.set("targetType", q.targetType);
      sp.set("page", String(q.page ?? 1));
      sp.set("pageSize", String(q.pageSize ?? 50));
      return authed<{ entries: AuditEntry[]; total: number; page: number; pageSize: number }>(`/admin/audit?${sp}`);
    },
    siteStatus: async () => (await authed<{ status: ApiSiteStatus }>("/admin/site/status")).status,
    imports: (status?: ImportStatus) => authed<{ items: ApiImportItem[]; runs: ApiImportRun[] }>(`/admin/imports${status ? `?status=${status}` : ""}`),
    runImport: (days = 10) =>
      authed<{ runId: number; summary: Record<string, number>; items: { title: string; date: string; outcome: string; songId: number | null; message: string | null }[] }>(
        "/admin/imports/run",
        { method: "POST", body: JSON.stringify({ days }) },
      ),
    resolveImport: async (id: number, body: { action: "link"; songId: number } | { action: "create" } | { action: "ignore" }) =>
      (await authed<{ item: ApiImportItem }>(`/admin/imports/${id}`, { method: "PATCH", body: JSON.stringify(body) })).item,
  },
  masses: {
    list: async () => (await authed<{ masses: ApiMass[] }>("/masses")).masses,
    /** Missas sugeridas para todos de hoje até domingo. */
    suggestions: async () => (await authed<{ masses: ApiMass[] }>("/masses/suggestions")).masses,
    get: async (id: string) => (await authed<{ mass: ApiMass }>(`/masses/${id}`)).mass,
    create: async (id: string, body: ApiMassBody) => (await authed<{ mass: ApiMass }>("/masses", { method: "POST", body: JSON.stringify({ id, ...body }) })).mass,
    /** Com `version`, só grava se ninguém salvou depois dela (senão, 409 MASS_CONFLICT com a missa atual). */
    update: async (id: string, body: ApiMassBody, version?: number) =>
      (await authed<{ mass: ApiMass }>(`/masses/${id}`, { method: "PUT", body: JSON.stringify(body), headers: version ? { "if-match": String(version) } : {} })).mass,
    remove: (id: string) => authed<void>(`/masses/${id}`, { method: "DELETE" }),
    share: async (id: string, userIds: string[]) =>
      (await authed<{ mass: ApiMass }>(`/masses/${id}/shares`, { method: "PUT", body: JSON.stringify({ userIds }) })).mass,
    leave: (id: string) => authed<void>(`/masses/${id}/shares/me`, { method: "DELETE" }),
    createLink: (id: string) => authed<{ token: string; path: string }>(`/masses/${id}/share-link`, { method: "POST" }),
    revokeLink: (id: string) => authed<void>(`/masses/${id}/share-link`, { method: "DELETE" }),
    join: async (token: string) => (await authed<{ mass: ApiMass }>("/masses/join", { method: "POST", body: JSON.stringify({ token }) })).mass,
  },
};

export interface ProfileInput {
  name?: string;
  phone?: string | null;
  /** Substitui a lista inteira ([] tira todos). */
  movementIds?: number[];
  parish?: string | null;
  instrument?: string | null;
}

export interface AdminUserInput {
  name?: string;
  email?: string;
  /** Substitui a lista inteira ([] tira todos). */
  movementIds?: number[];
  roles?: ApiRole[];
}

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
