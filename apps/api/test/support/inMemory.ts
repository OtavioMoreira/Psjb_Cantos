import { randomUUID } from "node:crypto";
import { loadEnv } from "../../src/config/env.js";
import { buildContainer, type Adapters } from "../../src/container.js";
import { AppError } from "../../src/domain/errors.js";
import type { Mass } from "../../src/domain/mass.js";
import type { Movement } from "../../src/domain/movement.js";
import type { Flag, Song } from "../../src/domain/song.js";
import type { User, UserWithPassword } from "../../src/domain/user.js";
import type {
  AuthToken,
  AuthTokenPurpose,
  AuthTokenRepository,
  EmailMessage,
  EmailSender,
  ExternalPsalm,
  ImportItem,
  ImportItemData,
  ImportRepository,
  ImportRun,
  ImportStatus,
  PdfReader,
  PsalmSource,
  TrustedDeviceRepository,
  AdminUserData,
  CreateUserData,
  ProfileData,
  FileStorage,
  FlagData,
  FlagRepository,
  MassData,
  MassFilters,
  MassRepository,
  MovementRepository,
  PasswordHasher,
  Session,
  SessionRepository,
  SongData,
  SongFilters,
  SongRepository,
  UserFilters,
  UserRepository,
} from "../../src/interfaces/index.js";
import { JoseTokenService } from "../../src/services/JoseTokenService.js";

// Adaptadores em memória: os mesmos contratos de interfaces/, sem banco nem disco.

export class InMemoryUsers implements UserRepository {
  rows: UserWithPassword[] = [];
  constructor(private readonly movements?: InMemoryMovements) {}

  private pub = ({ passwordHash: _h, ...u }: UserWithPassword): User => ({ ...u });

  async findById(id: string) {
    const u = this.rows.find((r) => r.id === id);
    return u ? this.pub(u) : null;
  }
  async findByEmailWithPassword(email: string) {
    return this.rows.find((r) => r.email === email) ?? null;
  }
  async findByIdWithPassword(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async emailExists(email: string) {
    return this.rows.some((r) => r.email === email);
  }
  async create(d: CreateUserData) {
    const now = new Date();
    const u: UserWithPassword = {
      id: randomUUID(),
      name: d.name,
      email: d.email,
      passwordHash: d.passwordHash,
      phone: d.phone,
      photoUrl: null,
      movement: this.movementRef(d.movementId),
      parish: null,
      instrument: null,
      status: d.status,
      blockedReason: null,
      roles: d.roles,
      mustChangePassword: false,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(u);
    return this.pub(u);
  }
  private filtered(f: UserFilters) {
    const plain = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    const q = f.q ? plain(f.q) : "";
    const order = { pending: 0, blocked: 1, active: 2 };
    return this.rows
      .filter((r) => (!f.status || r.status === f.status) && (!f.role || r.roles.includes(f.role)))
      .filter((r) => !q || plain(`${r.name} ${r.email} ${r.movement?.name ?? ""}`).includes(q))
      .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
  }
  async list(f: UserFilters) {
    const rows = this.filtered(f);
    const page = f.page && f.pageSize ? rows.slice((f.page - 1) * f.pageSize, f.page * f.pageSize) : rows;
    return page.map(this.pub);
  }
  async count(f: UserFilters) {
    return this.filtered(f).length;
  }
  async countByStatus() {
    const out = { pending: 0, active: 0, blocked: 0 };
    for (const r of this.rows) out[r.status]++;
    return out;
  }
  async updateStatus(id: string, status: User["status"], blockedReason: string | null = null) {
    const u = this.rows.find((r) => r.id === id);
    if (!u) return null;
    Object.assign(u, { status, blockedReason });
    return this.pub(u);
  }
  async updatePhoto(id: string, photoUrl: string | null) {
    const u = this.rows.find((r) => r.id === id);
    if (!u) return null;
    u.photoUrl = photoUrl;
    return this.pub(u);
  }
  private movementRef(id: number | null) {
    return id ? { id, name: this.movements?.rows.find((m) => m.id === id)?.name ?? "" } : null;
  }
  async updateProfile(id: string, d: ProfileData) {
    const u = this.rows.find((r) => r.id === id);
    if (!u) return null;
    const { movementId, ...rest } = d;
    Object.assign(u, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    if (movementId !== undefined) u.movement = this.movementRef(movementId);
    return this.pub(u);
  }
  async adminUpdate(id: string, d: AdminUserData) {
    const u = this.rows.find((r) => r.id === id);
    if (!u) return null;
    if (d.email && this.rows.some((r) => r.email === d.email && r.id !== id)) throw new AppError("EMAIL_TAKEN", "Já existe uma conta com este e-mail.");
    const { movementId, ...rest } = d;
    Object.assign(u, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    if (movementId !== undefined) u.movement = this.movementRef(movementId);
    return this.pub(u);
  }
  async updatePassword(id: string, passwordHash: string, mustChange: boolean) {
    const u = this.rows.find((r) => r.id === id);
    if (u) Object.assign(u, { passwordHash, mustChangePassword: mustChange });
  }
  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
  async countActiveAdmins(excludeId?: string) {
    return this.rows.filter((r) => r.status === "active" && r.roles.includes("admin") && r.id !== excludeId).length;
  }
  async touchLastLogin(id: string) {
    const u = this.rows.find((r) => r.id === id);
    if (u) u.lastLoginAt = new Date();
  }
  async filterActiveIds(ids: string[]) {
    return ids.filter((id) => this.rows.some((r) => r.id === id && r.status === "active"));
  }
  async searchActive(q: string, excludeId: string, limit: number) {
    const t = q.toLowerCase();
    return this.rows
      .filter((r) => r.status === "active" && r.id !== excludeId && (r.name.toLowerCase().includes(t) || r.email.includes(t)))
      .slice(0, limit)
      .map((r) => ({ id: r.id, name: r.name, email: r.email, photoUrl: r.photoUrl, movement: r.movement?.name ?? null }));
  }
}

export class InMemoryMovements implements MovementRepository {
  rows: Movement[] = [];
  private seq = 0;

  async list() {
    return [...this.rows].sort((a, b) => a.name.localeCompare(b.name));
  }
  async findById(id: number) {
    return this.rows.find((m) => m.id === id) ?? null;
  }
  async create(name: string) {
    if (this.rows.some((m) => m.name.toLowerCase() === name.toLowerCase())) throw new AppError("MOVEMENT_TAKEN", "Já existe.");
    const m = { id: ++this.seq, name, members: 0, createdAt: new Date() };
    this.rows.push(m);
    return m;
  }
  async rename(id: number, name: string) {
    const m = this.rows.find((x) => x.id === id);
    if (m) m.name = name;
    return m ?? null;
  }
  async delete(id: number) {
    const m = this.rows.find((x) => x.id === id);
    if (!m) return false;
    if (m.members > 0) throw new AppError("MOVEMENT_IN_USE", "Em uso.");
    this.rows = this.rows.filter((x) => x.id !== id);
    return true;
  }
}

export class InMemoryMasses implements MassRepository {
  rows: Mass[] = [];
  constructor(private readonly users: InMemoryUsers) {}

  private person(id: string) {
    const u = this.users.rows.find((r) => r.id === id)!;
    return { id: u.id, name: u.name, photoUrl: u.photoUrl };
  }
  async findById(id: string) {
    const m = this.rows.find((r) => r.id === id);
    return m ? structuredClone(m) : null;
  }
  async listForUser(userId: string, f: MassFilters) {
    return this.rows
      .filter((m) => m.owner.id === userId || m.sharedWith.some((p) => p.id === userId))
      .filter((m) => !f.q || m.name.toLowerCase().includes(f.q.toLowerCase()))
      .map((m) => structuredClone(m));
  }
  async create(ownerId: string, d: MassData, id?: string) {
    if (id && this.rows.some((r) => r.id === id)) throw new AppError("MASS_EXISTS", "Já existe.");
    const m: Mass = {
      id: id ?? randomUUID(),
      owner: this.person(ownerId),
      ...structuredClone(d),
      sharedWith: [],
      shareToken: null,
      version: 1,
      updatedBy: this.person(ownerId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rows.push(m);
    return structuredClone(m);
  }
  async update(id: string, d: MassData, updatedBy: string, expectedVersion?: number) {
    const m = this.rows.find((r) => r.id === id);
    if (!m || (expectedVersion !== undefined && m.version !== expectedVersion)) return null;
    Object.assign(m, structuredClone(d), { updatedAt: new Date(), version: m.version + 1, updatedBy: this.person(updatedBy) });
    return structuredClone(m);
  }
  async delete(id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => r.id !== id);
    return this.rows.length < before;
  }
  async setShares(id: string, userIds: string[]) {
    const m = this.rows.find((r) => r.id === id);
    if (!m) return null;
    m.sharedWith = userIds.map((u) => this.person(u));
    return structuredClone(m);
  }
  async removeShare(id: string, userId: string) {
    const m = this.rows.find((r) => r.id === id);
    if (m) m.sharedWith = m.sharedWith.filter((p) => p.id !== userId);
  }
  async addShare(id: string, userId: string) {
    const m = this.rows.find((r) => r.id === id);
    if (m && !m.sharedWith.some((p) => p.id === userId)) m.sharedWith.push(this.person(userId));
  }
  async findByShareToken(token: string) {
    const m = this.rows.find((r) => r.shareToken === token);
    return m ? structuredClone(m) : null;
  }
  async setShareToken(id: string, token: string | null) {
    const m = this.rows.find((r) => r.id === id);
    if (m) m.shareToken = token;
  }
  async countSongUsage(songId: number) {
    return this.rows.filter((m) => m.slots.some((s) => s.items.some((i) => i.songId === songId))).length;
  }
}

export class InMemoryFlags implements FlagRepository {
  rows: Flag[] = [];
  private seq = 0;
  async list() {
    return [...this.rows];
  }
  async findByIds(ids: number[]) {
    return this.rows.filter((f) => ids.includes(f.id));
  }
  async create(d: FlagData) {
    if (this.rows.some((f) => f.group === d.group && f.slug === d.slug)) throw new AppError("FLAG_TAKEN", "Já existe.");
    const f = { id: ++this.seq, ...d, songs: 0 };
    this.rows.push(f);
    return f;
  }
  async update(id: number, d: FlagData) {
    const f = this.rows.find((x) => x.id === id);
    if (f) Object.assign(f, d);
    return f ?? null;
  }
  async delete(id: number) {
    const before = this.rows.length;
    this.rows = this.rows.filter((f) => f.id !== id);
    return this.rows.length < before;
  }
}

export class InMemorySongs implements SongRepository {
  rows: Song[] = [];
  private seq = 0;
  constructor(private readonly flags: InMemoryFlags) {}

  private build(id: number, d: SongData, prev?: Song): Song {
    const flags = this.flags.rows.filter((f) => d.flagIds.includes(f.id)).map(({ id, group, slug, name, color }) => ({ id, group, slug, name, color }));
    const { flagIds: _f, source, ...rest } = d;
    // Igual ao SQL: a fonte só é gravada na criação; no update, ausente = não muda.
    const src = source !== undefined ? source : (prev?.source ?? null);
    return { id, ...structuredClone(rest), source: src, flags, createdAt: prev?.createdAt ?? new Date(), updatedAt: new Date() };
  }
  private unique(d: SongData, id?: number) {
    if (this.rows.some((s) => s.id !== id && ((d.number && s.number === d.number) || s.slug === d.slug)))
      throw new AppError("SONG_TAKEN", "Já existe.");
  }
  async list(f: SongFilters) {
    // Mesma regra do SQL: OU dentro do grupo, E entre grupos.
    const groups = new Map<string, number[]>();
    for (const flag of this.flags.rows.filter((x) => f.flagIds?.includes(x.id))) groups.set(flag.group, [...(groups.get(flag.group) ?? []), flag.id]);
    const all = this.rows.filter(
      (s) =>
        (f.includeInactive || s.active) &&
        (!f.q || s.title.toLowerCase().includes(f.q.toLowerCase())) &&
        [...groups.values()].every((ids) => s.flags.some((x) => ids.includes(x.id))),
    );
    return { songs: all.slice((f.page - 1) * f.pageSize, f.page * f.pageSize).map((s) => structuredClone(s)), total: all.length };
  }
  async findById(id: number) {
    const s = this.rows.find((x) => x.id === id);
    return s ? structuredClone(s) : null;
  }
  async findBySlug(slug: string) {
    const s = this.rows.find((x) => x.slug === slug);
    return s ? structuredClone(s) : null;
  }
  async create(d: SongData) {
    this.unique(d);
    const s = this.build(++this.seq, d);
    this.rows.push(s);
    return structuredClone(s);
  }
  async update(id: number, d: SongData) {
    const i = this.rows.findIndex((x) => x.id === id);
    if (i < 0) return null;
    this.unique(d, id);
    this.rows[i] = this.build(id, d, this.rows[i]);
    return structuredClone(this.rows[i]);
  }
  async delete(id: number) {
    const before = this.rows.length;
    this.rows = this.rows.filter((s) => s.id !== id);
    return this.rows.length < before;
  }
  async setMedia(id: number, field: keyof Song["media"], url: string | null) {
    const s = this.rows.find((x) => x.id === id);
    if (!s) return null;
    s.media[field] = url;
    return structuredClone(s);
  }
  async existingIds(ids: number[]) {
    return ids.filter((id) => this.rows.some((s) => s.id === id));
  }
}

export class InMemorySessions implements SessionRepository {
  rows: (Session & { tokenHash: string; replacedBy: string | null })[] = [];

  async create(d: Parameters<SessionRepository["create"]>[0]) {
    const s = { id: randomUUID(), userId: d.userId, familyId: d.familyId, tokenHash: d.tokenHash, expiresAt: d.expiresAt, remember: d.remember, revokedAt: null, replacedBy: null };
    this.rows.push(s);
    return s;
  }
  async findByTokenHash(hash: string) {
    return this.rows.find((r) => r.tokenHash === hash) ?? null;
  }
  async rotate(id: string, replacedBy: string) {
    const s = this.rows.find((r) => r.id === id);
    if (s) Object.assign(s, { revokedAt: new Date(), replacedBy });
  }
  async revokeFamily(familyId: string) {
    this.rows.filter((r) => r.familyId === familyId && !r.revokedAt).forEach((r) => (r.revokedAt = new Date()));
  }
  async revokeAllForUser(userId: string) {
    this.rows.filter((r) => r.userId === userId && !r.revokedAt).forEach((r) => (r.revokedAt = new Date()));
  }
  async revokeOthers(userId: string, keepFamilyId: string) {
    this.rows.filter((r) => r.userId === userId && r.familyId !== keepFamilyId && !r.revokedAt).forEach((r) => (r.revokedAt = new Date()));
  }
}

export class InMemoryAuthTokens implements AuthTokenRepository {
  rows: (AuthToken & { tokenHash: string })[] = [];

  async create(d: Parameters<AuthTokenRepository["create"]>[0]) {
    const t = { id: randomUUID(), userId: d.userId, purpose: d.purpose, tokenHash: d.tokenHash, data: d.data ?? {}, attempts: 0, expiresAt: d.expiresAt, usedAt: null, createdAt: new Date() };
    this.rows.push(t);
    return { ...t };
  }
  async findById(id: string) {
    const t = this.rows.find((r) => r.id === id);
    return t ? { ...t } : null;
  }
  async consume(hash: string, purposes: AuthTokenPurpose[], now: Date) {
    const t = this.rows.find((r) => r.tokenHash === hash && purposes.includes(r.purpose) && !r.usedAt && r.expiresAt > now);
    if (!t) return null;
    t.usedAt = now;
    return { ...t };
  }
  async invalidate(userId: string, purpose: AuthTokenPurpose) {
    this.rows.filter((r) => r.userId === userId && r.purpose === purpose && !r.usedAt).forEach((r) => (r.usedAt = new Date()));
  }
  async addAttempt(id: string) {
    const t = this.rows.find((r) => r.id === id);
    return t ? ++t.attempts : Number.POSITIVE_INFINITY;
  }
  async lastCreatedAt(userId: string, purpose: AuthTokenPurpose) {
    const times = this.rows.filter((r) => r.userId === userId && r.purpose === purpose).map((r) => r.createdAt.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  }
}

export class InMemoryTrustedDevices implements TrustedDeviceRepository {
  rows: { userId: string; tokenHash: string; expiresAt: Date }[] = [];
  async create(d: Parameters<TrustedDeviceRepository["create"]>[0]) {
    this.rows.push({ userId: d.userId, tokenHash: d.tokenHash, expiresAt: d.expiresAt });
  }
  async isTrusted(userId: string, tokenHash: string, now: Date) {
    return this.rows.some((r) => r.userId === userId && r.tokenHash === tokenHash && r.expiresAt > now);
  }
  async revokeAllForUser(userId: string) {
    this.rows = this.rows.filter((r) => r.userId !== userId);
  }
}

/** Caixa de saída falsa: guarda os e-mails para o teste ler o link ou o código. */
export class MemoryEmail implements EmailSender {
  sent: EmailMessage[] = [];
  fail = false;
  async send(m: EmailMessage) {
    if (this.fail) throw new Error("falha simulada");
    this.sent.push(m);
  }
  last(to?: string) {
    return [...this.sent].reverse().find((m) => !to || m.to === to);
  }
  /** Primeiro link com ?token= do último e-mail (para a pessoa). */
  token(to?: string) {
    return this.last(to)?.text.match(/token=([\w-]+)/)?.[1];
  }
}

/** Hash falso e rápido: os testes não precisam do custo do argon2. */
export const fakeHasher: PasswordHasher = {
  hash: async (p) => `hashed:${p}`,
  verify: async (h, p) => h === `hashed:${p}`,
};

export class MemoryStorage implements FileStorage {
  files = new Map<string, Buffer>();
  async put(path: string, data: Buffer) {
    const url = `mem://${path}`;
    this.files.set(url, data);
    return url;
  }
  async delete(url: string) {
    this.files.delete(url);
  }
}

/** Publicação do site falsa: conta quantas vezes foi pedida. */
export class FakePublisher {
  calls = 0;
  constructor(public enabled = true) {}
  async publish() {
    this.calls++;
  }
}


export class InMemoryImports implements ImportRepository {
  items: ImportItem[] = [];
  runs: ImportRun[] = [];
  async findItem(source: string, externalId: string) {
    return structuredClone(this.items.find((i) => i.source === source && i.externalId === externalId) ?? null);
  }
  async getItem(id: number) {
    return structuredClone(this.items.find((i) => i.id === id) ?? null);
  }
  async songIdByPdfHash(source: string, hash: string) {
    return this.items.find((i) => i.source === source && i.pdfHash === hash && i.songId && i.status === "created")?.songId ?? null;
  }
  async saveItem(d: ImportItemData) {
    const i = this.items.findIndex((x) => x.source === d.source && x.externalId === d.externalId);
    const now = new Date();
    const item: ImportItem = i >= 0 ? { ...this.items[i], ...d, updatedAt: now } : { id: this.items.length + 1, ...d, createdAt: now, updatedAt: now };
    if (i >= 0) this.items[i] = item;
    else this.items.push(item);
    return structuredClone(item);
  }
  async listItems({ status, limit }: { status?: ImportStatus; limit: number }) {
    return structuredClone(this.items.filter((i) => !status || i.status === status).slice(0, limit));
  }
  async startRun(source: string, trigger: ImportRun["trigger"]) {
    this.runs.push({ id: this.runs.length + 1, source, trigger, startedAt: new Date(), finishedAt: null, summary: {}, error: null });
    return this.runs.length;
  }
  async finishRun(id: number, summary: Record<string, number>, error: string | null) {
    Object.assign(this.runs[id - 1], { finishedAt: new Date(), summary, error });
  }
  async listRuns(limit: number) {
    return structuredClone([...this.runs].reverse().slice(0, limit));
  }
}

/** Fonte de salmos falsa: a lista e os arquivos ficam em memória; conta os downloads. */
export class FakePsalmSource implements PsalmSource {
  readonly id = "diocese-montenegro";
  readonly name = "Diocese de Montenegro";
  readonly url = "https://www.diocesemontenegro.org.br/salmos-e-aclamacoes";
  list: ExternalPsalm[] = [];
  files = new Map<string, Buffer>();
  downloads: string[] = [];
  fail: Error | null = null;
  async listUpcoming() {
    if (this.fail) throw this.fail;
    return structuredClone(this.list);
  }
  async download(url: string) {
    this.downloads.push(url);
    const f = this.files.get(url);
    if (!f) throw new Error(`arquivo inexistente: ${url}`);
    return f;
  }
}

/** "PDF" falso: o conteúdo é o próprio texto, uma linha por linha. */
export class FakePdfReader implements PdfReader {
  async lines(pdf: Buffer) {
    return pdf.toString("utf8").split("\n");
  }
}

export function makeTestContainer(envOverrides: Record<string, string> = {}) {
  const env = loadEnv({ NODE_ENV: "test", ...envOverrides });
  const movements = new InMemoryMovements();
  const users = new InMemoryUsers(movements);
  const flags = new InMemoryFlags();
  const adapters: Adapters & {
    users: InMemoryUsers;
    sessions: InMemorySessions;
    authTokens: InMemoryAuthTokens;
    trustedDevices: InMemoryTrustedDevices;
    email: MemoryEmail;
    movements: InMemoryMovements;
    masses: InMemoryMasses;
    songs: InMemorySongs;
    flags: InMemoryFlags;
    site: FakePublisher;
    storage: MemoryStorage;
    psalmSource: FakePsalmSource;
    pdf: FakePdfReader;
    imports: InMemoryImports;
  } = {
    users,
    sessions: new InMemorySessions(),
    authTokens: new InMemoryAuthTokens(),
    trustedDevices: new InMemoryTrustedDevices(),
    email: new MemoryEmail(),
    movements,
    masses: new InMemoryMasses(users),
    songs: new InMemorySongs(flags),
    flags,
    site: new FakePublisher(),
    psalmSource: new FakePsalmSource(),
    pdf: new FakePdfReader(),
    imports: new InMemoryImports(),
    hasher: fakeHasher,
    tokens: new JoseTokenService(env.JWT_SECRET, env.ACCESS_TOKEN_TTL_SECONDS),
    storage: new MemoryStorage(),
    clock: { now: () => new Date() },
  };
  return { container: buildContainer(env, adapters), adapters };
}
