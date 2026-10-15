import type { AuthToken, AuthTokenPurpose, AuthTokenRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface TokenRow {
  id: string;
  user_id: string;
  purpose: AuthTokenPurpose;
  data: Record<string, string>;
  attempts: number;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

const toToken = (r: TokenRow): AuthToken => ({
  id: r.id,
  userId: r.user_id,
  purpose: r.purpose,
  data: r.data,
  attempts: r.attempts,
  expiresAt: r.expires_at,
  usedAt: r.used_at,
  createdAt: r.created_at,
});

export class PgAuthTokenRepository implements AuthTokenRepository {
  constructor(private readonly pool: Pool) {}

  async create(d: Parameters<AuthTokenRepository["create"]>[0]) {
    const { rows } = await this.pool.query<TokenRow>(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at, data) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [d.userId, d.purpose, d.tokenHash, d.expiresAt, JSON.stringify(d.data ?? {})],
    );
    return toToken(rows[0]);
  }

  async findById(id: string) {
    const { rows } = await this.pool.query<TokenRow>("SELECT * FROM auth_tokens WHERE id = $1", [id]);
    return rows[0] ? toToken(rows[0]) : null;
  }

  async consume(tokenHash: string, purposes: AuthTokenPurpose[], now: Date) {
    const { rows } = await this.pool.query<TokenRow>(
      `UPDATE auth_tokens SET used_at = $3
       WHERE token_hash = $1 AND purpose = ANY($2::auth_token_purpose[]) AND used_at IS NULL AND expires_at > $3
       RETURNING *`,
      [tokenHash, purposes, now],
    );
    return rows[0] ? toToken(rows[0]) : null;
  }

  async invalidate(userId: string, purpose: AuthTokenPurpose) {
    await this.pool.query("UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL", [userId, purpose]);
  }

  async addAttempt(id: string) {
    const { rows } = await this.pool.query<{ attempts: number }>("UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts", [id]);
    return rows[0]?.attempts ?? Number.POSITIVE_INFINITY;
  }

  async lastCreatedAt(userId: string, purpose: AuthTokenPurpose) {
    const { rows } = await this.pool.query<{ max: Date | null }>("SELECT max(created_at) FROM auth_tokens WHERE user_id = $1 AND purpose = $2", [userId, purpose]);
    return rows[0]?.max ?? null;
  }
}
