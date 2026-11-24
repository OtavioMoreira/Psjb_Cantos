import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

const DAY = 24 * 60 * 60 * 1000;
const hash = (c: string) => c.repeat(64).slice(0, 64);
const days = (n: number) => new Date(Date.now() + n * DAY);
const count = async (pool: { query: (s: string) => Promise<{ rows: { n: number }[] }> }, table: string) =>
  (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

describe.skipIf(!dbUrl)("PgMaintenanceRepository (faxina do cron)", () => {
  const { repos, factory, pool } = useTestDb();

  it("apaga só o que venceu (ou foi usado) antes da folga; o resto fica", async () => {
    const u = await factory.user();
    const family = "11111111-1111-1111-1111-111111111111";
    // Sessões: vencida há 10 dias (sai), vencida há 2 dias (fica pela folga), revogada mas no prazo (fica: detecta reuso).
    await repos.sessions.create({ userId: u.id, familyId: family, tokenHash: hash("a"), expiresAt: days(-10), remember: true, userAgent: null });
    await repos.sessions.create({ userId: u.id, familyId: family, tokenHash: hash("b"), expiresAt: days(-2), remember: true, userAgent: null });
    const live = await repos.sessions.create({ userId: u.id, familyId: family, tokenHash: hash("c"), expiresAt: days(20), remember: true, userAgent: null });
    await pool.query("UPDATE sessions SET revoked_at = now() WHERE id = $1", [live.id]);

    // Tokens: vencido há 10 dias (sai), usado há 10 dias mas ainda "válido" (sai), aberto (fica).
    await repos.authTokens.create({ userId: u.id, purpose: "password_reset", tokenHash: hash("d"), expiresAt: days(-10) });
    const used = await repos.authTokens.create({ userId: u.id, purpose: "invite", tokenHash: hash("e"), expiresAt: days(5) });
    await pool.query("UPDATE auth_tokens SET used_at = now() - interval '10 days' WHERE id = $1", [used.id]);
    await repos.authTokens.create({ userId: u.id, purpose: "invite", tokenHash: hash("f"), expiresAt: days(5) });

    await repos.trustedDevices.create({ userId: u.id, tokenHash: hash("g"), expiresAt: days(-30), userAgent: null });
    await repos.trustedDevices.create({ userId: u.id, tokenHash: hash("h"), expiresAt: days(10), userAgent: null });

    expect(await repos.maintenance.purgeExpired(new Date(), 7)).toEqual({ sessions: 1, authTokens: 2, trustedDevices: 1 });
    expect(await count(pool, "sessions")).toBe(2);
    expect(await count(pool, "auth_tokens")).toBe(1);
    expect(await count(pool, "trusted_devices")).toBe(1);
    // Rodar de novo não apaga mais nada.
    expect(await repos.maintenance.purgeExpired(new Date(), 7)).toEqual({ sessions: 0, authTokens: 0, trustedDevices: 0 });
  });
});
