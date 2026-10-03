import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "../interfaces/index.js";

// argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações).
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export class Argon2PasswordHasher implements PasswordHasher {
  hash(plain: string) {
    return hash(plain, OPTIONS);
  }

  async verify(hashed: string, plain: string) {
    try {
      return await verify(hashed, plain);
    } catch {
      return false; // hash em formato inválido conta como senha errada
    }
  }
}
