import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

describe.skipIf(!dbUrl)("PgRateLimitCounter", () => {
  const { repos } = useTestDb();

  it("soma por chave dentro da janela e recomeça quando ela vence", async () => {
    const r = repos.rateLimits;
    expect(await r.hit("POST /login|1.1.1.1", 60_000)).toMatchObject({ hits: 1 });
    const second = await r.hit("POST /login|1.1.1.1", 60_000);
    expect(second.hits).toBe(2);
    expect(second.ttlMs).toBeGreaterThan(55_000);
    expect(second.ttlMs).toBeLessThanOrEqual(60_000);
    expect((await r.hit("POST /login|2.2.2.2", 60_000)).hits).toBe(1);

    await r.hit("curta", 200);
    await new Promise((ok) => setTimeout(ok, 300));
    expect((await r.hit("curta", 200)).hits).toBe(1);
  });

  it("pedidos simultâneos não se perdem (UPSERT atômico)", async () => {
    await Promise.all(Array.from({ length: 20 }, () => repos.rateLimits.hit("junto", 60_000)));
    expect((await repos.rateLimits.hit("junto", 60_000)).hits).toBe(21);
  });
});

describe.skipIf(!dbUrl)("PgRateLimitCounter: peek e reset (senhas erradas no login)", () => {
  const { repos } = useTestDb();

  it("peek lê sem somar; janela vencida conta 0; reset apaga", async () => {
    const r = repos.rateLimits;
    expect(await r.peek("login-fail|a@x.com", 60_000)).toBe(0);
    await r.hit("login-fail|a@x.com", 60_000);
    await r.hit("login-fail|a@x.com", 60_000);
    expect(await r.peek("login-fail|a@x.com", 60_000)).toBe(2);
    expect(await r.peek("login-fail|a@x.com", 60_000)).toBe(2);
    expect(await r.peek("login-fail|a@x.com", 1)).toBe(0);
    await r.reset("login-fail|a@x.com");
    expect(await r.peek("login-fail|a@x.com", 60_000)).toBe(0);
  });
});
