import type { FastifyRateLimitStore, FastifyRateLimitStoreCtor } from "@fastify/rate-limit";
import type { RateLimitCounter } from "../interfaces/index.js";

type Callback = Parameters<FastifyRateLimitStore["incr"]>[1];
type ChildOptions = Parameters<FastifyRateLimitStore["child"]>[0];

/**
 * Store do @fastify/rate-limit apoiada num RateLimitCounter (Postgres em produção). A chave leva a
 * rota, porque cada rota tem o seu limite (login 10, cadastro 5...), e o IP.
 */
export function counterStore(counter: RateLimitCounter): FastifyRateLimitStoreCtor {
  class CounterStore implements FastifyRateLimitStore {
    prefix = "";

    incr(key: string, cb: Callback, timeWindow: number) {
      counter.hit(`${this.prefix}|${key}`, timeWindow).then(
        ({ hits, ttlMs }) => cb(null, { current: hits, ttl: ttlMs }),
        (err: Error) => cb(err),
      );
    }

    child(routeOptions: ChildOptions) {
      const store = new CounterStore();
      // O plugin manda a rota em routeInfo (fora dos tipos publicados).
      const route = (routeOptions as ChildOptions & { routeInfo?: { method?: string; url?: string } }).routeInfo;
      store.prefix = `${route?.method ?? ""} ${route?.url ?? routeOptions.path}`;
      return store;
    }
  }
  return CounterStore;
}
