import type { AccessTokenPayload } from "../interfaces/index.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Preenchido pelo middleware authenticate. */
    auth?: AccessTokenPayload;
  }
}
