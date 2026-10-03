import pg from "pg";
import type { TestProject } from "vitest/node";
import { runMigrations } from "../../src/database/migrator.js";

/**
 * Prepara o banco de teste: cria se não existir e aplica as migrations.
 * Sem Postgres disponível, os testes de integração são pulados, a não ser em CI (REQUIRE_TEST_DB=1), onde falham.
 */
export default async function setup(project: TestProject) {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://psjb:psjb@localhost:5432/psjb_cantos_test";
  const dbName = new URL(url).pathname.slice(1);
  // Trava de segurança: os testes apagam tudo, então só rodam em banco com nome *_test.
  if (!dbName.endsWith("_test")) throw new Error(`TEST_DATABASE_URL precisa apontar para um banco *_test (recebi "${dbName}").`);

  try {
    const admin = new pg.Client({ connectionString: url.replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
    await admin.connect();
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!exists.rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const pool = new pg.Pool({ connectionString: url, max: 2 });
    await runMigrations(pool);
    await pool.end();
    project.provide("dbUrl", url);
  } catch (err) {
    if (process.env.REQUIRE_TEST_DB === "1") throw err;
    console.warn(`\n⚠ Testes de integração pulados: sem Postgres em ${url.replace(/:[^:@/]+@/, ":***@")} (${(err as Error).message}).\n  Suba com "docker compose up -d postgres".\n`);
    project.provide("dbUrl", null);
  }
}

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string | null;
  }
}
