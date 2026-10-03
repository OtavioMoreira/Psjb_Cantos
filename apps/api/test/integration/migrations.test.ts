import { describe, expect, it } from "vitest";
import { runMigrations } from "../../src/database/migrator.js";
import { dbUrl, useTestDb } from "../support/db.js";

describe.skipIf(!dbUrl)("Migrations", () => {
  const { pool } = useTestDb();

  it("rodar de novo não aplica nada (idempotente)", async () => {
    expect(await runMigrations(pool)).toEqual([]);
    const { rows } = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY name");
    expect(rows.map((r) => r.name)).toEqual([
      "001_users_roles_sessions.sql",
      "002_movements.sql",
      "003_masses.sql",
      "004_mass_share_link.sql",
      "005_songs_flags.sql",
    ]);
  });

  it("os papéis admin e musico vêm da migration", async () => {
    const { rows } = await pool.query<{ name: string }>("SELECT name FROM roles ORDER BY name");
    expect(rows.map((r) => r.name)).toEqual(["admin", "musico"]);
  });

  it("o banco recusa e-mail fora do padrão (minúsculo e sem espaços)", async () => {
    await expect(
      pool.query("INSERT INTO users (name, email, password_hash) VALUES ('X', ' Maiusculo@Teste.com', 'h')"),
    ).rejects.toThrow(/users_email_lower/);
  });
});
