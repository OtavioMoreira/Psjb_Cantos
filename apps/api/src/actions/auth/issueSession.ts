import { randomUUID } from "node:crypto";
import type { User } from "../../domain/user.js";
import type { Clock, SessionRepository, TokenService } from "../../interfaces/index.js";

export interface SessionTtl {
  shortDays: number;
  longDays: number;
}

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  /** "Manter conectado": o cookie persiste até refreshExpiresAt; senão, morre ao fechar o navegador. */
  remember: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Emite access token + refresh token. Na rotação, a nova sessão herda a família e a validade
 * absoluta da anterior, então "manter conectado" nunca passa dos 30 dias desde o login.
 */
export async function issueSession(
  deps: { sessions: SessionRepository; tokens: TokenService; clock: Clock; ttl: SessionTtl },
  user: User,
  opts: { remember: boolean; userAgent: string | null; familyId?: string; expiresAt?: Date },
): Promise<IssuedSession & { sessionId: string }> {
  const { token: refreshToken, hash } = deps.tokens.generateRefreshToken();
  const days = opts.remember ? deps.ttl.longDays : deps.ttl.shortDays;
  const expiresAt = opts.expiresAt ?? new Date(deps.clock.now().getTime() + days * DAY);

  const session = await deps.sessions.create({
    userId: user.id,
    familyId: opts.familyId ?? randomUUID(),
    tokenHash: hash,
    expiresAt,
    remember: opts.remember,
    userAgent: opts.userAgent,
  });
  const { token: accessToken, expiresIn } = await deps.tokens.signAccessToken({ userId: user.id, roles: user.roles });

  return { accessToken, expiresIn, refreshToken, refreshExpiresAt: expiresAt, remember: opts.remember, sessionId: session.id };
}
