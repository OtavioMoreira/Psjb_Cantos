import type { Pool } from "../database/pool.js";
import type { MaintenanceRepository, PurgeResult } from "../interfaces/index.js";

/** Faxina das tabelas que só crescem: sessões, tokens de e-mail e aparelhos confiáveis vencidos. */
export class PgMaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly pool: Pool) {}

  async purgeExpired(now: Date, graceDays: number): Promise<PurgeResult> {
    const limit = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
    // Sessão revogada ainda no prazo fica: é ela que detecta o reuso de um refresh token roubado.
    const sessions = await this.pool.query("DELETE FROM sessions WHERE expires_at < $1", [limit]);
    const authTokens = await this.pool.query("DELETE FROM auth_tokens WHERE expires_at < $1 OR used_at < $1", [limit]);
    const trustedDevices = await this.pool.query("DELETE FROM trusted_devices WHERE expires_at < $1", [limit]);
    return { sessions: sessions.rowCount ?? 0, authTokens: authTokens.rowCount ?? 0, trustedDevices: trustedDevices.rowCount ?? 0 };
  }
}
