import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { AppError } from "../domain/errors.js";

/**
 * Rotinas do Cron da Vercel: sem login, protegidas pelo CRON_SECRET, que a Vercel manda em
 * "Authorization: Bearer <segredo>". Sem o segredo configurado, as rotas ficam desligadas.
 */
export function cronGuard(secret: string | undefined) {
  return async (req: FastifyRequest) => {
    if (!secret) throw new AppError("NOT_CONFIGURED", "A rotina automática não está configurada (CRON_SECRET).");
    const sent = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) throw new AppError("UNAUTHORIZED", "Credencial do cron inválida.");
  };
}
