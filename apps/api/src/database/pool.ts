import pg from "pg";

/**
 * Pool único por processo. Na Vercel (Fluid compute) a mesma instância atende várias requisições,
 * então um pool pequeno basta; no Neon, use a string "-pooler" (PgBouncer) para não esgotar conexões.
 */
export function createPool(connectionString: string) {
  const local = /@(localhost|127\.0\.0\.1|postgres)[:/]/.test(connectionString);
  return new pg.Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
    // O Neon exige TLS; o Postgres do docker-compose não tem.
    ssl: local ? undefined : { rejectUnauthorized: true },
  });
}

export type Pool = pg.Pool;
