// Portas da arquitetura hexagonal: as actions só conhecem estes contratos.
// As implementações (Postgres, argon2, jose, Vercel Blob) ficam em repositories/ e services/.

import type { AuditEntry, AuditEntryData, AuditTarget } from "../domain/audit.js";
import type { Mass, MassSlot, PersonRef, SeasonId, YearId } from "../domain/mass.js";
import type { Movement } from "../domain/movement.js";
import type { Flag, FlagGroup, Song, SongMedia, SongSource } from "../domain/song.js";
import type { Role, User, UserStatus, UserWithPassword } from "../domain/user.js";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  movementIds: number[];
  status: UserStatus;
  roles: Role[];
}

/** Campos que a própria pessoa edita no perfil. */
export interface ProfileData {
  name?: string;
  phone?: string | null;
  /** Substitui a lista inteira. */
  movementIds?: number[];
  parish?: string | null;
  instrument?: string | null;
}

/** Campos que o admin edita. `roles` substitui a lista inteira. */
export interface AdminUserData {
  name?: string;
  email?: string;
  phone?: string | null;
  /** Substitui a lista inteira. */
  movementIds?: number[];
  roles?: Role[];
}

export interface UserFilters {
  status?: UserStatus;
  role?: Role;
  /** Nome, e-mail ou movimento, sem diferenciar maiúsculas nem acentos. */
  q?: string;
  /** Paginação (a partir de 1). Sem ela, vem tudo. */
  page?: number;
  pageSize?: number;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  findByIdWithPassword(id: string): Promise<UserWithPassword | null>;
  emailExists(email: string): Promise<boolean>;
  create(data: CreateUserData): Promise<User>;
  list(filters: UserFilters): Promise<User[]>;
  /** Quantas contas atendem aos filtros (ignora a paginação). */
  count(filters: UserFilters): Promise<number>;
  /** Contas por status, para o resumo do admin. */
  countByStatus(): Promise<Record<UserStatus, number>>;
  updateStatus(id: string, status: UserStatus, blockedReason?: string | null): Promise<User | null>;
  updatePhoto(id: string, photoUrl: string | null): Promise<User | null>;
  updateProfile(id: string, data: ProfileData): Promise<User | null>;
  /** Lança EMAIL_TAKEN se o e-mail já é de outra conta. */
  adminUpdate(id: string, data: AdminUserData): Promise<User | null>;
  updatePassword(id: string, passwordHash: string, mustChange: boolean): Promise<void>;
  /** Apaga a conta; as missas dela vão junto (CASCADE). false se não existia. */
  delete(id: string): Promise<boolean>;
  /** Admins ativos, sem contar `excludeId`. Para nunca ficar sem nenhum. */
  countActiveAdmins(excludeId?: string): Promise<number>;
  touchLastLogin(id: string): Promise<void>;
  /** Dos IDs informados, devolve os que existem e estão ativos. */
  filterActiveIds(ids: string[]): Promise<string[]>;
  /** Pessoas ativas para compartilhar missa (nome, e-mail ou movimento), sem a própria pessoa. */
  searchActive(q: string, excludeId: string, limit: number): Promise<(PersonRef & { email: string; movements: string[] })[]>;
}

export interface MovementRepository {
  list(): Promise<Movement[]>;
  findById(id: number): Promise<Movement | null>;
  /** Lança MOVEMENT_TAKEN se o nome já existe (sem diferenciar maiúsculas). */
  create(name: string): Promise<Movement>;
  rename(id: number, name: string): Promise<Movement | null>;
  /** false se não existia. Lança MOVEMENT_IN_USE se há pessoas no movimento. */
  delete(id: number): Promise<boolean>;
  /** Dos IDs informados, os que não existem (para recusar com 400). */
  missingIds(ids: number[]): Promise<number[]>;
}

export interface MassData {
  name: string;
  date: string | null;
  time: string | null;
  season: SeasonId | null;
  year: YearId | null;
  slots: MassSlot[];
  suggested: boolean;
}

export interface MassFilters {
  /** upcoming: hoje em diante (e sem data); past: antes de hoje. Hoje = fuso de Brasília. */
  when: "upcoming" | "past" | "all";
  q?: string;
}

export interface MassRepository {
  findById(id: string): Promise<Mass | null>;
  /** Missas que a pessoa criou ou que foram compartilhadas com ela. */
  listForUser(userId: string, filters: MassFilters): Promise<Mass[]>;
  /** Missas sugeridas da semana: de hoje até o domingo seguinte (hoje, se for domingo), no fuso de Brasília. */
  listWeekSuggestions(): Promise<Mass[]>;
  /** `id` opcional: o front gera o UUID para salvar offline e sincronizar depois. Lança MASS_EXISTS se já existe. */
  create(ownerId: string, data: MassData, id?: string): Promise<Mass>;
  /**
   * Grava e soma 1 na versão. Com `expectedVersion`, só grava se a missa ainda estiver nela
   * (atômico); null = não existe ou outra pessoa salvou antes.
   */
  update(id: string, data: MassData, updatedBy: string, expectedVersion?: number): Promise<Mass | null>;
  delete(id: string): Promise<boolean>;
  /** Substitui a lista inteira de convidados. */
  setShares(id: string, userIds: string[]): Promise<Mass | null>;
  removeShare(id: string, userId: string): Promise<void>;
  /** Adiciona um convidado (sem erro se já era). */
  addShare(id: string, userId: string): Promise<void>;
  findByShareToken(token: string): Promise<Mass | null>;
  /** null desativa o link. */
  setShareToken(id: string, token: string | null): Promise<void>;
  /** Quantas missas usam o canto (para bloquear a exclusão). */
  countSongUsage(songId: number): Promise<number>;
}

export interface FlagData {
  group: FlagGroup;
  slug: string;
  name: string;
  color: string | null;
  position: number;
}

export interface FlagRepository {
  list(): Promise<Flag[]>;
  findByIds(ids: number[]): Promise<Flag[]>;
  /** Lança FLAG_TAKEN se já existe o mesmo slug no grupo. */
  create(data: FlagData): Promise<Flag>;
  update(id: number, data: FlagData): Promise<Flag | null>;
  delete(id: number): Promise<boolean>;
}

export interface SongData {
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  lyrics: string;
  media: SongMedia;
  flagIds: number[];
  active: boolean;
  /** Crédito da fonte (importação). Só gravado na criação; ausente = não muda. */
  source?: SongSource | null;
}

export interface SongFilters {
  q?: string;
  /** Mesma regra do site: OU dentro do mesmo grupo, E entre grupos diferentes. */
  flagIds?: number[];
  includeInactive: boolean;
  page: number;
  pageSize: number;
}

export interface SongRepository {
  list(filters: SongFilters): Promise<{ songs: Song[]; total: number }>;
  findById(id: number): Promise<Song | null>;
  findBySlug(slug: string): Promise<Song | null>;
  /** Lança SONG_TAKEN se o número ou o slug já existem. userId null = rotina automática (importação). */
  create(data: SongData, userId: string | null): Promise<Song>;
  update(id: number, data: SongData, userId: string | null): Promise<Song | null>;
  delete(id: number): Promise<boolean>;
  setMedia(id: number, field: keyof SongMedia, url: string | null, userId: string | null): Promise<Song | null>;
  /** Dos ids informados, devolve os que existem. */
  existingIds(ids: number[]): Promise<number[]>;
}

export interface Session {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  remember: boolean;
}

export interface SessionRepository {
  create(data: { userId: string; familyId: string; tokenHash: string; expiresAt: Date; remember: boolean; userAgent: string | null }): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  /** Marca a sessão como usada e aponta para a que a substituiu (rotação). */
  rotate(id: string, replacedBy: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  /** Revoga as outras sessões da pessoa, mantendo a família informada (o aparelho atual). */
  revokeOthers(userId: string, keepFamilyId: string): Promise<void>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface AccessTokenPayload {
  userId: string;
  roles: Role[];
}

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<{ token: string; expiresIn: number }>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  /** Token opaco do refresh e o hash que vai para o banco. */
  generateRefreshToken(): { token: string; hash: string };
  hashRefreshToken(token: string): string;
}

export interface FileStorage {
  /** Grava o arquivo e devolve a URL pública. */
  put(path: string, data: Buffer, contentType: string): Promise<string>;
  delete(url: string): Promise<void>;
}

/** Storage que aceita envio direto do navegador (Vercel Blob): arquivos maiores que o corpo das Functions. */
export interface DirectUploadStorage extends FileStorage {
  /** Token de uso único que só grava `path`, com estes tipos e até este tamanho. */
  createUploadToken(path: string, opts: { contentTypes: string[]; maxBytes: number }): Promise<string>;
  /** Caminho do arquivo se a URL é deste storage; null se for de outro lugar. */
  pathOf(url: string): string | null;
  /** Tamanho e primeiros bytes, para conferir o tipo de verdade. */
  inspect(url: string): Promise<{ size: number; firstBytes: Buffer }>;
}

export const supportsDirectUpload = (s: FileStorage): s is DirectUploadStorage => "createUploadToken" in s;

/** Publica o site de novo (build), para cantos e flags alterados aparecerem nas páginas estáticas. */
export interface SitePublisher {
  /** false = publicação não configurada neste ambiente. */
  readonly enabled: boolean;
  publish(): Promise<void>;
}

export interface PurgeResult {
  sessions: number;
  authTokens: number;
  trustedDevices: number;
  /** Registros de auditoria com mais de 2 anos. */
  auditLog: number;
  /** Janelas do limite de tentativas já vencidas. */
  rateLimits: number;
}

/** Faxina periódica das tabelas que só crescem. */
export interface MaintenanceRepository {
  /** Apaga o que venceu (ou foi usado) antes de `now - graceDays`. */
  purgeExpired(now: Date, graceDays: number): Promise<PurgeResult>;
}

export interface SiteState {
  /** Última mudança em cantos ou flags (marcada pelos gatilhos do banco). */
  contentChangedAt: Date;
  publishedAt: Date | null;
  publishedByName: string | null;
}

/** Quando o conteúdo mudou e quando foi o último "Publicar no site". */
export interface SiteStateRepository {
  get(): Promise<SiteState>;
  markPublished(byName: string): Promise<SiteState>;
}

export interface AuditFilters {
  targetType?: AuditTarget;
  targetId?: string;
  page: number;
  pageSize: number;
}

/** Registro de auditoria das ações de admin. */
export interface AuditRepository {
  record(entry: AuditEntryData): Promise<void>;
  /** Mais recentes primeiro. */
  list(filters: AuditFilters): Promise<{ entries: AuditEntry[]; total: number }>;
}

/** Contador do limite de tentativas, compartilhado entre instâncias (janela fixa). */
export interface RateLimitCounter {
  /** Soma 1 na chave e devolve o total na janela atual e quanto falta para ela acabar. */
  hit(key: string, windowMs: number): Promise<{ hits: number; ttlMs: number }>;
  /** Total na janela atual, sem somar (0 se não há janela aberta). */
  peek(key: string, windowMs: number): Promise<number>;
  reset(key: string): Promise<void>;
}

/** Desafio "não sou um robô" (Cloudflare Turnstile ou Google reCAPTCHA), conferido no servidor. */
export interface HumanVerifier {
  /** false = sem chave configurada: ninguém precisa resolver o desafio. */
  readonly enabled: boolean;
  verify(token: string, ip: string | null): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}

export type AuthTokenPurpose = "password_reset" | "invite" | "email_change" | "login_code";

export interface AuthToken {
  id: string;
  userId: string;
  purpose: AuthTokenPurpose;
  data: Record<string, string>;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

/** Tokens de uso único enviados por e-mail. Só o hash fica guardado. */
export interface AuthTokenRepository {
  create(data: { userId: string; purpose: AuthTokenPurpose; tokenHash: string; expiresAt: Date; data?: Record<string, string> }): Promise<AuthToken>;
  findById(id: string): Promise<AuthToken | null>;
  /**
   * Marca como usado e devolve o token, de forma atômica: dois cliques no mesmo link não passam.
   * null se não existe, já foi usado, venceu ou não é de um dos propósitos aceitos.
   */
  consume(tokenHash: string, purposes: AuthTokenPurpose[], now: Date): Promise<AuthToken | null>;
  /** Invalida os tokens ainda abertos da pessoa para o propósito (pedir um link novo derruba o anterior). */
  invalidate(userId: string, purpose: AuthTokenPurpose): Promise<void>;
  /** Soma uma tentativa errada e devolve o total. */
  addAttempt(id: string): Promise<number>;
  /** Quando foi criado o último token do propósito (para limitar reenvios). */
  lastCreatedAt(userId: string, purpose: AuthTokenPurpose): Promise<Date | null>;
}

/** "Confiar neste aparelho": dispensa o código do 2FA por 30 dias. */
export interface TrustedDeviceRepository {
  create(data: { userId: string; tokenHash: string; expiresAt: Date; userAgent: string | null }): Promise<void>;
  isTrusted(userId: string, tokenHash: string, now: Date): Promise<boolean>;
  revokeAllForUser(userId: string): Promise<void>;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Envio de e-mail transacional (Resend em produção; console no desenvolvimento e nos testes). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

// ---------- Importação de salmos e aclamações (fonte externa) ----------

/** Um item da lista da fonte: um salmo ou uma aclamação de uma data. */
export interface ExternalPsalm {
  /** Identificador estável na fonte (código do arquivo + data). */
  externalId: string;
  /** "1º Domingo do Advento, Ano B | Salmo 79" */
  title: string;
  /** Data da celebração, AAAA-MM-DD. */
  date: string;
  pdfUrl: string | null;
  audioUrl: string | null;
}

/** Fonte externa de salmos (site da Diocese de Montenegro). */
export interface PsalmSource {
  /** Identificador gravado nos itens ("diocese-montenegro"). */
  readonly id: string;
  /** Crédito mostrado na página do canto. */
  readonly name: string;
  readonly url: string;
  listUpcoming(): Promise<ExternalPsalm[]>;
  download(url: string): Promise<Buffer>;
}

/** Linhas de texto de um PDF, de cima para baixo, página a página. */
export interface PdfReader {
  lines(pdf: Buffer): Promise<string[]>;
}

export type ImportStatus = "created" | "linked" | "review" | "ignored" | "failed";

export interface ImportItem {
  id: number;
  source: string;
  externalId: string;
  title: string;
  kind: "salmo" | "aclamacao";
  celebrationDate: string;
  pdfUrl: string | null;
  audioUrl: string | null;
  pdfHash: string | null;
  status: ImportStatus;
  songId: number | null;
  candidateSongIds: number[];
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export type ImportItemData = Omit<ImportItem, "id" | "createdAt" | "updatedAt">;

export interface ImportRun {
  id: number;
  source: string;
  trigger: "cron" | "manual";
  startedAt: Date;
  finishedAt: Date | null;
  summary: Record<string, number>;
  error: string | null;
}

export interface ImportRepository {
  findItem(source: string, externalId: string): Promise<ImportItem | null>;
  getItem(id: number): Promise<ImportItem | null>;
  /** Canto que a rotina criou a partir de um PDF com este hash (os do repertório antigo não contam). */
  songIdByPdfHash(source: string, hash: string): Promise<number | null>;
  /** Cria o item; se já existe (mesma fonte e id), atualiza. */
  saveItem(data: ImportItemData): Promise<ImportItem>;
  listItems(opts: { status?: ImportStatus; limit: number }): Promise<ImportItem[]>;
  startRun(source: string, trigger: ImportRun["trigger"]): Promise<number>;
  finishRun(id: number, summary: Record<string, number>, error: string | null): Promise<void>;
  listRuns(limit: number): Promise<ImportRun[]>;
}
