import { loadEnv } from "../config/env.js";
import { runMigrations } from "./migrator.js";
import { createPool } from "./pool.js";

// npm run db:migrate: aplica as migrations que faltam no DATABASE_URL.
async function main() {
  const pool = createPool(loadEnv().DATABASE_URL);
  try {
    const applied = await runMigrations(pool);
    applied.forEach((f) => console.log(`✔ ${f}`));
    console.log(applied.length ? `${applied.length} migration(s) aplicada(s).` : "Banco já está atualizado.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
