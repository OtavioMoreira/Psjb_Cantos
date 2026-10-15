import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

const hash = (c: string) => c.repeat(64).slice(0, 64);
const later = (ms: number) => new Date(Date.now() + ms);

describe.skipIf(!dbUrl)("PgAuthTokenRepository", () => {
  const { repos, factory, pool } = useTestDb();

  it("cria e consome uma vez só, conferindo propósito e validade", async () => {
    const u = await factory.user();
    const t = await repos.authTokens.create({ userId: u.id, purpose: "email_change", tokenHash: hash("a"), expiresAt: later(60_000), data: { newEmail: "novo@teste.com" } });
    expect(t).toMatchObject({ userId: u.id, purpose: "email_change", data: { newEmail: "novo@teste.com" }, attempts: 0, usedAt: null });

    expect(await repos.authTokens.consume(hash("a"), ["password_reset"], new Date())).toBeNull();
    const used = await repos.authTokens.consume(hash("a"), ["email_change", "invite"], new Date());
    expect(used).toMatchObject({ id: t.id, data: { newEmail: "novo@teste.com" } });
    expect(used?.usedAt).toBeInstanceOf(Date);
    expect(await repos.authTokens.consume(hash("a"), ["email_change"], new Date())).toBeNull();

    await repos.authTokens.create({ userId: u.id, purpose: "password_reset", tokenHash: hash("b"), expiresAt: later(-1000) });
    expect(await repos.authTokens.consume(hash("b"), ["password_reset"], new Date())).toBeNull();
  });

  it("dois consumos simultâneos do mesmo token: só um passa", async () => {
    const u = await factory.user();
    await repos.authTokens.create({ userId: u.id, purpose: "password_reset", tokenHash: hash("c"), expiresAt: later(60_000) });
    const results = await Promise.all([1, 2, 3].map(() => repos.authTokens.consume(hash("c"), ["password_reset"], new Date())));
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("invalida os abertos do propósito, conta tentativas e informa o último envio", async () => {
    const u = await factory.user();
    expect(await repos.authTokens.lastCreatedAt(u.id, "login_code")).toBeNull();
    const code = await repos.authTokens.create({ userId: u.id, purpose: "login_code", tokenHash: hash("d"), expiresAt: later(60_000) });
    await repos.authTokens.create({ userId: u.id, purpose: "password_reset", tokenHash: hash("e"), expiresAt: later(60_000) });

    expect(await repos.authTokens.addAttempt(code.id)).toBe(1);
    expect(await repos.authTokens.addAttempt(code.id)).toBe(2);
    expect((await repos.authTokens.findById(code.id))?.attempts).toBe(2);
    expect(await repos.authTokens.lastCreatedAt(u.id, "login_code")).toBeInstanceOf(Date);

    await repos.authTokens.invalidate(u.id, "login_code");
    expect(await repos.authTokens.consume(hash("d"), ["login_code"], new Date())).toBeNull();
    expect(await repos.authTokens.consume(hash("e"), ["password_reset"], new Date())).not.toBeNull();
  });

  it("excluir a pessoa apaga os tokens e os aparelhos confiáveis", async () => {
    const u = await factory.user();
    await repos.authTokens.create({ userId: u.id, purpose: "invite", tokenHash: hash("f"), expiresAt: later(60_000) });
    await repos.trustedDevices.create({ userId: u.id, tokenHash: hash("g"), expiresAt: later(60_000), userAgent: "x".repeat(400) });
    await repos.users.delete(u.id);
    const { rows } = await pool.query("SELECT (SELECT count(*) FROM auth_tokens)::int AS t, (SELECT count(*) FROM trusted_devices)::int AS d");
    expect(rows[0]).toEqual({ t: 0, d: 0 });
  });
});

describe.skipIf(!dbUrl)("PgTrustedDeviceRepository", () => {
  const { repos, factory } = useTestDb();

  it("confia só no aparelho certo, da pessoa certa, dentro da validade; revogar apaga todos", async () => {
    const a = await factory.user();
    const b = await factory.user();
    await repos.trustedDevices.create({ userId: a.id, tokenHash: hash("1"), expiresAt: later(60_000), userAgent: null });
    await repos.trustedDevices.create({ userId: a.id, tokenHash: hash("2"), expiresAt: later(-1000), userAgent: null });

    expect(await repos.trustedDevices.isTrusted(a.id, hash("1"), new Date())).toBe(true);
    expect(await repos.trustedDevices.isTrusted(b.id, hash("1"), new Date())).toBe(false);
    expect(await repos.trustedDevices.isTrusted(a.id, hash("2"), new Date())).toBe(false);

    await repos.trustedDevices.revokeAllForUser(a.id);
    expect(await repos.trustedDevices.isTrusted(a.id, hash("1"), new Date())).toBe(false);
  });
});
