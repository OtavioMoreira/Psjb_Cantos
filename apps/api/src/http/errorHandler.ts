import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../domain/errors.js";

/** Formato único de erro: { error: { code, message, details? } }. */
export function errorHandler(err: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  if (err instanceof AppError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
  }
  // Erros do próprio Fastify e plugins (JSON malformado, rate limit, arquivo grande...).
  const status = err.statusCode ?? 500;
  if (status < 500) {
    const code = status === 429 ? "RATE_LIMITED" : status === 413 ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST";
    const message = status === 429 ? "Muitas tentativas. Aguarde um pouco e tente de novo." : err.message;
    return reply.status(status).send({ error: { code, message } });
  }
  request.log.error(err);
  return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Erro inesperado. Tente de novo em instantes." } });
}
