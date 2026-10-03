import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type { Clock, SessionRepository, TokenService, UserRepository } from "../../interfaces/index.js";
import { issueSession, type IssuedSession, type SessionTtl } from "./issueSession.js";

export interface RefreshDeps {
  users: UserRepository;
  sessions: SessionRepository;
  tokens: TokenService;
  clock: Clock;
  ttl: SessionTtl;
}

/** Troca o refresh token por um novo (rotação) e emite um access token novo. */
export class RefreshSessionAction {
  constructor(private readonly deps: RefreshDeps) {}

  async execute(refreshToken: string | undefined, ctx: { userAgent: string | null }): Promise<IssuedSession & { user: UserDTO }> {
    if (!refreshToken) throw unauthorized();
    const session = await this.deps.sessions.findByTokenHash(this.deps.tokens.hashRefreshToken(refreshToken));
    if (!session) throw unauthorized();

    // Token já usado: alguém pode ter copiado o cookie. Derruba a família inteira.
    if (session.revokedAt) {
      await this.deps.sessions.revokeFamily(session.familyId);
      throw unauthorized();
    }
    if (session.expiresAt <= this.deps.clock.now()) throw unauthorized();

    const user = await this.deps.users.findById(session.userId);
    if (!user || user.status !== "active") {
      await this.deps.sessions.revokeFamily(session.familyId);
      throw unauthorized();
    }

    const next = await issueSession(this.deps, user, {
      remember: session.remember,
      userAgent: ctx.userAgent,
      familyId: session.familyId,
      expiresAt: session.expiresAt,
    });
    await this.deps.sessions.rotate(session.id, next.sessionId);
    return { ...next, user: toUserDTO(user) };
  }
}

const unauthorized = () => new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
