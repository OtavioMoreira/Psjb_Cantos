import { runMigrations } from "./migrator.js";
import { createPool } from "./pool.js";

// npm run db:migrate: aplica as migrations que faltam no DATABASE_URL.
// Só precisa do DATABASE_URL (não valida o resto do ambiente): dá para rodar contra o Neon com
// `DATABASE_URL=… npx tsx src/database/migrate.ts`, sem baixar os segredos da API.
const LOCAL = "postgres://psjb:psjb@localhost:5432/psjb_cantos";

async function main() {
  const url = process.env.DATABASE_URL ?? LOCAL;
  if (!/^postgres(ql)?:\/\//.test(url))
    throw new Error("DATABASE_URL inválido. A Vercel não deixa baixar variáveis sensíveis: copie a connection string do painel do Neon.");
  const pool = createPool(url);
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
