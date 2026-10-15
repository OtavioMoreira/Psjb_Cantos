import type { TrustedDeviceRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

export class PgTrustedDeviceRepository implements TrustedDeviceRepository {
  constructor(private readonly pool: Pool) {}

  async create(d: Parameters<TrustedDeviceRepository["create"]>[0]) {
    await this.pool.query("INSERT INTO trusted_devices (user_id, token_hash, expires_at, user_agent) VALUES ($1, $2, $3, $4)", [
      d.userId,
      d.tokenHash,
      d.expiresAt,
      d.userAgent?.slice(0, 300) ?? null,
    ]);
  }

  async isTrusted(userId: string, tokenHash: string, now: Date) {
    const { rowCount } = await this.pool.query("SELECT 1 FROM trusted_devices WHERE user_id = $1 AND token_hash = $2 AND expires_at > $3", [userId, tokenHash, now]);
    return (rowCount ?? 0) > 0;
  }

  async revokeAllForUser(userId: string) {
    await this.pool.query("DELETE FROM trusted_devices WHERE user_id = $1", [userId]);
  }
}
