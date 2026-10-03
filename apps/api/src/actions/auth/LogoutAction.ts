import type { SessionRepository, TokenService } from "../../interfaces/index.js";

/** Revoga a sessão do refresh token (e as rotações dela). Sem token, não faz nada. */
export class LogoutAction {
  constructor(private readonly deps: { sessions: SessionRepository; tokens: TokenService }) {}

  async execute(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const session = await this.deps.sessions.findByTokenHash(this.deps.tokens.hashRefreshToken(refreshToken));
    if (session) await this.deps.sessions.revokeFamily(session.familyId);
  }
}
