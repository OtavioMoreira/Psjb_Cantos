import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/buildApp.js";
import type { RateLimitCounter } from "../../src/interfaces/index.js";
import { makeTestContainer } from "../support/inMemory.js";

/** Contador compartilhado em memória: faz o papel da tabela rate_limits do Postgres. */
class SharedCounter implements RateLimitCounter {
  hits = new Map<string, number>();
  fail = false;
  async hit(key: string) {
    if (this.fail) throw new Error("banco fora do ar");
    const n = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, n);
    return { hits: n, ttlMs: 60_000 };
  }
  async peek(key: string) {
    return this.hits.get(key) ?? 0;
  }
  async reset(key: string) {
    this.hits.delete(key);
  }
}

const twoInstances = async (counter: RateLimitCounter) => {
  const make = async () => {
    const t = makeTestContainer({ NODE_ENV: "production", JWT_SECRET: "x".repeat(40), EMAIL_ENABLED: "false" });
    return buildApp({ container: { ...t.container, rateLimits: counter }, logger: false });
  };
  return [await make(), await make()] as const;
};
const forgot = (app: Awaited<ReturnType<typeof twoInstances>>[number]) =>
  app.inject({ method: "POST", url: "/api/auth/forgot", payload: { email: "ninguem@x.com" } });

describe("Limite de tentativas compartilhado entre instâncias", () => {
  it("as duas instâncias somam no mesmo contador (5 pedidos de recuperação por IP em 15 min)", async () => {
    const counter = new SharedCounter();
    const [a, b] = await twoInstances(counter);
    for (let i = 0; i < 3; i++) expect((await forgot(a)).statusCode).toBe(202);
    for (let i = 0; i < 2; i++) expect((await forgot(b)).statusCode).toBe(202);
    // 6º pedido, em qualquer instância: barrado.
    expect((await forgot(a)).statusCode).toBe(429);
    expect((await forgot(b)).statusCode).toBe(429);
    // A chave separa a rota (cada uma tem o seu limite) e o IP.
    expect([...counter.hits.keys()]).toEqual(["POST /api/auth/forgot|127.0.0.1"]);
  });

  it("se o contador falhar, o pedido passa (não derruba o login)", async () => {
    const counter = new SharedCounter();
    counter.fail = true;
    const [a] = await twoInstances(counter);
    expect((await forgot(a)).statusCode).toBe(202);
  });
});
