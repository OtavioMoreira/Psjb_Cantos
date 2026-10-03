import { AppError } from "../domain/errors.js";
import type { Role, User, UserStatus, UserWithPassword } from "../domain/user.js";
import type { CreateUserData, UserFilters, UserRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  phone: string | null;
  photo_url: string | null;
  movement_id: number | null;
  movement_name: string | null;
  status: UserStatus;
  blocked_reason: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  roles: Role[];
}

// Papéis e movimento vêm na mesma consulta, para não fazer N+1.
const SELECT = `
  SELECT u.*, m.name AS movement_name,
         COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
  FROM users u
  LEFT JOIN movements m ON m.id = u.movement_id
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id`;
const GROUP = "GROUP BY u.id, m.name";

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    photoUrl: row.photo_url,
    movement: row.movement_id ? { id: row.movement_id, name: row.movement_name ?? "" } : null,
    status: row.status,
    blockedReason: row.blocked_reason,
    roles: row.roles,
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

  async emailExists(email: string) {
    const { rowCount } = await this.pool.query("SELECT 1 FROM users WHERE email = $1", [email]);
    return Boolean(rowCount);
  }

  async create(data: CreateUserData) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (name, email, password_hash, phone, movement_id, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [data.name, data.email, data.passwordHash, data.phone, data.movementId, data.status],
      );
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

  async list(filters: UserFilters) {
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
      // Sem diferenciar maiúsculas. Ignorar acento depende da extensão unaccent (Fase 2).
      params.push(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
      const p = `$${params.length}`;
      where.push(`(u.name ILIKE ${p} OR u.email ILIKE ${p} OR m.name ILIKE ${p})`);
    }
    const { rows } = await this.pool.query<UserRow>(
      `${SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ${GROUP}
       ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'blocked' THEN 1 ELSE 2 END, u.name`,
      params,
    );
    return rows.map(toUser);
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
    const { rows } = await this.pool.query<{ id: string; name: string; email: string; photo_url: string | null; movement: string | null }>(
      `SELECT u.id, u.name, u.email, u.photo_url, m.name AS movement
       FROM users u LEFT JOIN movements m ON m.id = u.movement_id
       WHERE u.status = 'active' AND u.id <> $1
         AND ($2 = '%%' OR u.name ILIKE $2 OR u.email ILIKE $2 OR m.name ILIKE $2)
       ORDER BY u.name LIMIT $3`,
      [excludeId, term, limit],
    );
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, photoUrl: r.photo_url, movement: r.movement }));
  }
}
