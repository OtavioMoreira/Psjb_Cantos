// Portas da arquitetura hexagonal: as actions só conhecem estes contratos.
// As implementações (Postgres, argon2, jose, Vercel Blob) ficam em repositories/ e services/.

import type { Mass, MassSlot, PersonRef, SeasonId, YearId } from "../domain/mass.js";
import type { Movement } from "../domain/movement.js";
import type { Flag, FlagGroup, Song, SongMedia } from "../domain/song.js";
import type { Role, User, UserStatus, UserWithPassword } from "../domain/user.js";

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  movementId: number | null;
  status: UserStatus;
  roles: Role[];
}

export interface UserFilters {
  status?: UserStatus;
  role?: Role;
  q?: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  emailExists(email: string): Promise<boolean>;
  create(data: CreateUserData): Promise<User>;
  list(filters: UserFilters): Promise<User[]>;
  updateStatus(id: string, status: UserStatus, blockedReason?: string | null): Promise<User | null>;
  updatePhoto(id: string, photoUrl: string | null): Promise<User | null>;
  touchLastLogin(id: string): Promise<void>;
  /** Dos IDs informados, devolve os que existem e estão ativos. */
  filterActiveIds(ids: string[]): Promise<string[]>;
  /** Pessoas ativas para compartilhar missa (nome, e-mail ou movimento), sem a própria pessoa. */
  searchActive(q: string, excludeId: string, limit: number): Promise<(PersonRef & { email: string; movement: string | null })[]>;
}

export interface MovementRepository {
  list(): Promise<Movement[]>;
  findById(id: number): Promise<Movement | null>;
  /** Lança MOVEMENT_TAKEN se o nome já existe (sem diferenciar maiúsculas). */
  create(name: string): Promise<Movement>;
  rename(id: number, name: string): Promise<Movement | null>;
  /** false se não existia. Lança MOVEMENT_IN_USE se há pessoas no movimento. */
  delete(id: number): Promise<boolean>;
}

export interface MassData {
  name: string;
  date: string | null;
  time: string | null;
  season: SeasonId | null;
  year: YearId | null;
  slots: MassSlot[];
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
  /** `id` opcional: o front gera o UUID para salvar offline e sincronizar depois. Lança MASS_EXISTS se já existe. */
  create(ownerId: string, data: MassData, id?: string): Promise<Mass>;
  update(id: string, data: MassData, updatedBy: string): Promise<Mass | null>;
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
  /** Lança SONG_TAKEN se o número ou o slug já existem. */
  create(data: SongData, userId: string): Promise<Song>;
  update(id: number, data: SongData, userId: string): Promise<Song | null>;
  delete(id: number): Promise<boolean>;
  setMedia(id: number, field: keyof SongMedia, url: string | null, userId: string): Promise<Song | null>;
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

export interface Clock {
  now(): Date;
}
