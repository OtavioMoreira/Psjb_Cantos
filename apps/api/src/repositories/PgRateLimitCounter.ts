import type { Pool } from "../database/pool.js";
import type { RateLimitCounter } from "../interfaces/index.js";

/** Contador de janela fixa no Postgres: um UPSERT atômico por requisição, igual para todas as instâncias. */
export class PgRateLimitCounter implements RateLimitCounter {
  constructor(private readonly pool: Pool) {}

  async hit(key: string, windowMs: number) {
    const { rows } = await this.pool.query<{ hits: number; ttl: number }>(
      `INSERT INTO rate_limits (key, hits, window_start) VALUES ($1, 1, now())
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limits.window_start + make_interval(secs => $2 / 1000.0) <= now() THEN 1 ELSE rate_limits.hits + 1 END,
         window_start = CASE WHEN rate_limits.window_start + make_interval(secs => $2 / 1000.0) <= now() THEN now() ELSE rate_limits.window_start END
       RETURNING hits, GREATEST(0, EXTRACT(EPOCH FROM (window_start + make_interval(secs => $2 / 1000.0) - now())) * 1000)::int AS ttl`,
      [key.slice(0, 200), windowMs],
    );
    return { hits: rows[0].hits, ttlMs: rows[0].ttl };
  }

  async peek(key: string, windowMs: number) {
    const { rows } = await this.pool.query<{ hits: number }>(
      "SELECT hits FROM rate_limits WHERE key = $1 AND window_start + make_interval(secs => $2 / 1000.0) > now()",
      [key.slice(0, 200), windowMs],
    );
    return rows[0]?.hits ?? 0;
  }

  async reset(key: string) {
    await this.pool.query("DELETE FROM rate_limits WHERE key = $1", [key.slice(0, 200)]);
  }
}
