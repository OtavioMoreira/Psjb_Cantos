import { loadEnv } from "../config/env.js";
import { normalizeEmail } from "../domain/user.js";
import { Argon2PasswordHasher } from "../services/Argon2PasswordHasher.js";
import { createPool } from "./pool.js";

// Movimentos iniciais, só para ter o que escolher no cadastro. A coordenação revisa a lista
// pelo admin (POST/PATCH/DELETE /api/admin/movements).
const MOVEMENTS = [
  "Ministério de Música",
  "Renovação Carismática Católica (RCC)",
  "Pastoral da Juventude",
  "Pastoral Familiar",
  "Catequese",
  "Legião de Maria",
  "Equipes de Nossa Senhora (ENS)",
  "Ministros Extraordinários da Comunhão",
];

// Cria (ou reativa) o superadmin de teste. A senha 123456 fura a regra de 8+ caracteres
// de propósito, então em produção ela precisa vir explicitamente do ambiente.
async function main() {
  const env = loadEnv();
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? "superadmin@psjb.org.br");
  const password = process.env.SEED_ADMIN_PASSWORD ?? (env.NODE_ENV === "production" ? undefined : "123456");
  if (!password) throw new Error("Em produção, defina SEED_ADMIN_PASSWORD.");

  const pool = createPool(env.DATABASE_URL);
  try {
    const hash = await new Argon2PasswordHasher().hash(password);
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, status)
       VALUES ('Superadmin', $1, $2, 'active')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', updated_at = now()
       RETURNING id`,
      [email, hash],
    );
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name IN ('admin', 'musico')
       ON CONFLICT DO NOTHING`,
      [rows[0].id],
    );
    const added = await pool.query(
      `INSERT INTO movements (name) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING`,
      [MOVEMENTS],
    );
    console.log(`✔ Superadmin pronto: ${email}`);
    console.log(`✔ Movimentos: ${added.rowCount} novo(s), ${MOVEMENTS.length - (added.rowCount ?? 0)} já existia(m)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
