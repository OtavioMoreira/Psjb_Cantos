import { afterAll, beforeEach, inject } from "vitest";
import { createPool, type Pool } from "../../src/database/pool.js";
import { PgFlagRepository } from "../../src/repositories/PgFlagRepository.js";
import { PgMassRepository } from "../../src/repositories/PgMassRepository.js";
import { PgMovementRepository } from "../../src/repositories/PgMovementRepository.js";
import { PgSessionRepository } from "../../src/repositories/PgSessionRepository.js";
import { PgSongRepository } from "../../src/repositories/PgSongRepository.js";
import { PgUserRepository } from "../../src/repositories/PgUserRepository.js";
import type { Role, UserStatus } from "../../src/domain/user.js";
import type { SongData } from "../../src/interfaces/index.js";

/** URL do banco de teste, ou null se não há Postgres (os testes de integração são pulados). */
export const dbUrl = inject("dbUrl");

/**
 * Pool + repositórios reais, com o banco zerado antes de cada teste.
 * `roles` não é apagada: ela vem da migration (admin, musico).
 */
export function useTestDb() {
  const pool: Pool = createPool(dbUrl ?? "postgres://invalid@localhost/none");
  const repos = {
    users: new PgUserRepository(pool),
    sessions: new PgSessionRepository(pool),
    movements: new PgMovementRepository(pool),
    masses: new PgMassRepository(pool),
    songs: new PgSongRepository(pool),
    flags: new PgFlagRepository(pool),
  };

  beforeEach(async () => {
    await pool.query("TRUNCATE users, user_roles, sessions, movements, masses, mass_shares, songs, flags, song_flags RESTART IDENTITY CASCADE");
  });
  afterAll(() => pool.end());

  let n = 0;
  const factory = {
    user: (opts: { name?: string; email?: string; status?: UserStatus; roles?: Role[]; movementId?: number | null } = {}) => {
      n++;
      return repos.users.create({
        name: opts.name ?? `Pessoa ${n}`,
        email: opts.email ?? `pessoa${n}@teste.com`,
        passwordHash: "hash-de-teste",
        phone: null,
        movementId: opts.movementId ?? null,
        status: opts.status ?? "active",
        roles: opts.roles ?? ["musico"],
      });
    },
    song: (data: Partial<SongData> & { title: string }, userId: string) =>
      repos.songs.create(
        {
          number: null,
          slug: data.title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          composer: null,
          key: null,
          lyrics: "",
          media: { audio: null, audiomack: null, cifraPdf: null, partituraPdf: null },
          flagIds: [],
          active: true,
          ...data,
        },
        userId,
      ),
  };

  return { pool, repos, factory };
}
