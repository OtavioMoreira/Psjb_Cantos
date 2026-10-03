import type { FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { AppError } from "../domain/errors.js";
import type { Role } from "../domain/user.js";
import type { AccessTokenPayload, TokenService } from "../interfaces/index.js";

/** Exige "Authorization: Bearer <access token>" válido e preenche request.auth. */
export function authenticate(tokens: TokenService): preHandlerAsyncHookHandler {
  return async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token) throw new AppError("UNAUTHORIZED", "Entre para continuar.");
    request.auth = await tokens.verifyAccessToken(token);
  };
}

/**
 * Libera a rota só para quem tem pelo menos um dos papéis. Usar depois de authenticate.
 * Os papéis vêm do JWT (vale por 15 min); mudar o papel de alguém só pesa no próximo refresh.
 */
export function requireRole(...roles: Role[]): preHandlerAsyncHookHandler {
  return async (request) => {
    const auth = requireAuth(request);
    if (!roles.some((r) => auth.roles.includes(r))) throw new AppError("FORBIDDEN", "Você não tem permissão para esta área.");
  };
}

/** Para o controller: devolve o usuário autenticado (a rota precisa ter o authenticate). */
export function requireAuth(request: FastifyRequest): AccessTokenPayload {
  if (!request.auth) throw new AppError("UNAUTHORIZED", "Entre para continuar.");
  return request.auth;
}
