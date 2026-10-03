import type { Session, SessionRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface SessionRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  remember: boolean;
}

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  userId: r.user_id,
  familyId: r.family_id,
  expiresAt: r.expires_at,
  revokedAt: r.revoked_at,
  remember: r.remember,
});

export class PgSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async create(data: Parameters<SessionRepository["create"]>[0]) {
    const { rows } = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (user_id, family_id, token_hash, expires_at, remember, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.userId, data.familyId, data.tokenHash, data.expiresAt, data.remember, data.userAgent?.slice(0, 300) ?? null],
    );
    return toSession(rows[0]);
  }

  async findByTokenHash(tokenHash: string) {
    const { rows } = await this.pool.query<SessionRow>("SELECT * FROM sessions WHERE token_hash = $1", [tokenHash]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async rotate(id: string, replacedBy: string) {
    await this.pool.query("UPDATE sessions SET revoked_at = now(), replaced_by = $2 WHERE id = $1", [id, replacedBy]);
  }

  async revokeFamily(familyId: string) {
    await this.pool.query("UPDATE sessions SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL", [familyId]);
  }

  async revokeAllForUser(userId: string) {
    await this.pool.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  }
}
