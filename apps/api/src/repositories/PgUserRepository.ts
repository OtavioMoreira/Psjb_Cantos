import type { PoolClient } from "pg";
import { AppError } from "../domain/errors.js";
import type { MovementRef, Role, User, UserStatus, UserWithPassword } from "../domain/user.js";
import type { AdminUserData, CreateUserData, ProfileData, UserFilters, UserRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  photo_url: string | null;
  movements: MovementRef[];
  parish: string | null;
  instrument: string | null;
  must_change_password: boolean;
  status: UserStatus;
  blocked_reason: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: Role[];
}

// Papéis e movimentos vêm na mesma consulta, para não fazer N+1.
const SELECT = `
  SELECT u.*,
         COALESCE((SELECT json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY m.name)
                   FROM user_movements um JOIN movements m ON m.id = um.movement_id
                   WHERE um.user_id = u.id), '[]') AS movements,
         COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id`;
const GROUP = "GROUP BY u.id";

/** Algum movimento da pessoa com o nome parecido (sem acento). */
const movementMatches = (param: string) =>
  `EXISTS (SELECT 1 FROM user_movements um JOIN movements m ON m.id = um.movement_id WHERE um.user_id = u.id AND unaccent(m.name) ILIKE ${param})`;

/** Troca a lista inteira de movimentos da pessoa. */
async function setMovements(db: Pool | PoolClient, userId: string, ids: number[]) {
  await db.query("DELETE FROM user_movements WHERE user_id = $1", [userId]);
  if (ids.length)
    await db.query("INSERT INTO user_movements (user_id, movement_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING", [userId, ids]);
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photo_url,
    movements: row.movements,
    parish: row.parish,
    instrument: row.instrument,
    status: row.status,
    blockedReason: row.blocked_reason,
    roles: row.roles,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgUserRepository implements UserRepository {
  constructor(private readonly pool: Pool) {}

  private async one(where: string, params: unknown[]): Promise<UserRow | null> {
    const { rows } = await this.pool.query<UserRow>(`${SELECT} WHERE ${where} ${GROUP}`, params);
    return rows[0] ?? null;
  }

  async findById(id: string) {
    const row = await this.one("u.id = $1", [id]);
    return row && toUser(row);
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const row = await this.one("u.email = $1", [email]);
    return row && { ...toUser(row), passwordHash: row.password_hash };
  }

  async findByIdWithPassword(id: string): Promise<UserWithPassword | null> {
    const row = await this.one("u.id = $1", [id]);
    return row && { ...toUser(row), passwordHash: row.password_hash };
  }

  async emailExists(email: string) {
    const { rowCount } = await this.pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    return Boolean(rowCount);
  }

  async create(data: CreateUserData) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (name, email, password_hash, phone, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [data.name, data.email, data.passwordHash, data.phone, data.status],
      );
      await setMovements(client, rows[0].id, data.movementIds);
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::text[])`,
        [rows[0].id, data.roles],
      );
      await client.query("COMMIT");
      return (await this.findById(rows[0].id))!;
    } catch (err) {
      await client.query("ROLLBACK");
      // Corrida entre duas inscrições com o mesmo e-mail: o UNIQUE do banco é a palavra final.
      if ((err as { code?: string }).code === "23505")
        throw new AppError("EMAIL_TAKEN", "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.");
      throw err;
    } finally {
      client.release();
    }
  }

  /** WHERE dos filtros do admin (sem paginação). */
  private filterSql(filters: UserFilters) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      where.push(`u.status = $${params.length}`);
    }
    if (filters.role) {
      params.push(filters.role);
      where.push(`EXISTS (SELECT 1 FROM user_roles x JOIN roles y ON y.id = x.role_id WHERE x.user_id = u.id AND y.name = $${params.length})`);
    }
    if (filters.q) {
      // Sem diferenciar maiúsculas nem acentos; %, _ e \ digitados valem como texto.
      params.push(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
      const p = `unaccent($${params.length})`;
      where.push(`(unaccent(u.name) ILIKE ${p} OR unaccent(u.email) ILIKE ${p} OR ${movementMatches(p)})`);
    }
    return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
  }

  async list(filters: UserFilters) {
    const { where, params } = this.filterSql(filters);
    let page = "";
    if (filters.page && filters.pageSize) {
      params.push(filters.pageSize, (filters.page - 1) * filters.pageSize);
      page = `LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }
    const { rows } = await this.pool.query<UserRow>(
      `${SELECT} ${where}
       ${GROUP}
       ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END, u.name, u.id
       ${page}`,
      params,
    );
    return rows.map(toUser);
  }

  async count(filters: UserFilters) {
    const { where, params } = this.filterSql(filters);
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users u ${where}`,
      params,
    );
    return rows[0].n;
  }

  async countByStatus() {
    const { rows } = await this.pool.query<{ status: UserStatus; n: number }>("SELECT status, count(*)::int AS n FROM users GROUP BY status");
    const out: Record<UserStatus, number> = { pending: 0, active: 0, blocked: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  }

  async updateStatus(id: string, status: UserStatus, blockedReason: string | null = null) {
    const { rowCount } = await this.pool.query(
      "UPDATE users SET status = $2, blocked_reason = $3, updated_at = now() WHERE id = $1",
      [id, status, blockedReason],
    );
    return rowCount ? this.findById(id) : null;
  }

  async updatePhoto(id: string, photoUrl: string | null) {
    const { rowCount } = await this.pool.query("UPDATE users SET photo_url = $2, updated_at = now() WHERE id = $1", [id, photoUrl]);
    return rowCount ? this.findById(id) : null;
  }

  async updateProfile(id: string, data: ProfileData) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await this.patch(id, { name: data.name, phone: data.phone, parish: data.parish, instrument: data.instrument }, client);
      if (found && data.movementIds) await setMovements(client, id, data.movementIds);
      await client.query("COMMIT");
      return found ? this.findById(id) : null;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async adminUpdate(id: string, data: AdminUserData) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const found = await this.patch(id, { name: data.name, email: data.email, phone: data.phone }, client);
      if (!found) {
        await client.query("ROLLBACK");
        return null;
      }
      if (data.movementIds) await setMovements(client, id, data.movementIds);
      if (data.roles) {
        await client.query("DELETE FROM user_roles WHERE user_id = $1", [id]);
        await client.query(
          "INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = ANY($2::text[])",
          [id, data.roles],
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23505") throw new AppError("EMAIL_TAKEN", "Já existe uma conta com este e-mail.");
      throw err;
    } finally {
      client.release();
    }
    return this.findById(id);
  }

  /** UPDATE só das colunas definidas (undefined = não mexe). true se a conta existe. */
  private async patch(id: string, cols: Record<string, unknown>, db: Pool | PoolClient = this.pool) {
    const entries = Object.entries(cols).filter(([, v]) => v !== undefined);
    const sets = entries.map(([c], i) => `${c} = $${i + 2}`);
    const { rowCount } = await db.query(
      `UPDATE users SET ${[...sets, "updated_at = now()"].join(", ")} WHERE id = $1`,
      [id, ...entries.map(([, v]) => v)],
    );
    return Boolean(rowCount);
  }

  async updatePassword(id: string, passwordHash: string, mustChange: boolean) {
    await this.pool.query(
      "UPDATE users SET password_hash = $2, must_change_password = $3, updated_at = now() WHERE id = $1",
      [id, passwordHash, mustChange],
    );
  }

  async delete(id: string) {
    const { rowCount } = await this.pool.query("DELETE FROM users WHERE id = $1", [id]);
    return Boolean(rowCount);
  }

  async countActiveAdmins(excludeId?: string) {
    const { rows } = await this.pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM users u
       JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'admin' AND u.status = 'active' AND ($1::uuid IS NULL OR u.id <> $1)`,
      [excludeId ?? null],
    );
    return rows[0].n;
  }

  async touchLastLogin(id: string) {
    await this.pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [id]);
  }

  async filterActiveIds(ids: string[]) {
    if (!ids.length) return [];
    const { rows } = await this.pool.query<{ id: string }>("SELECT id FROM users WHERE id = ANY($1::uuid[]) AND status = 'active'", [ids]);
    return rows.map((r) => r.id);
  }

  async searchActive(q: string, excludeId: string, limit: number) {
    const term = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    const { rows } = await this.pool.query<{ id: string; name: string; email: string; photo_url: string | null; movements: string[] }>(
      `SELECT u.id, u.name, u.email, u.photo_url,
              ARRAY(SELECT m.name FROM user_movements um JOIN movements m ON m.id = um.movement_id
                    WHERE um.user_id = u.id ORDER BY m.name) AS movements
       FROM users u
       WHERE u.status = 'active' AND u.id <> $1
         AND ($2 = '%%' OR unaccent(u.name) ILIKE unaccent($2) OR u.email ILIKE $2 OR ${movementMatches("unaccent($2)")})
       ORDER BY u.name LIMIT $3`,
      [excludeId, term, limit],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, photoUrl: r.photo_url, movements: r.movements }));
  }
}
