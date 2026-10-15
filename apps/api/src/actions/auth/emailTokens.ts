import type { User } from "../../domain/user.js";
import type { AuthTokenPurpose, AuthTokenRepository, Clock, EmailMessage, EmailSender, TokenService } from "../../interfaces/index.js";

export const HOUR = 60 * 60 * 1000;

/** Validade de cada tipo de token (regras de negócio, §10). */
export const TOKEN_TTL: Record<AuthTokenPurpose, number> = {
  password_reset: HOUR,
  invite: 7 * 24 * HOUR,
  email_change: 24 * HOUR,
  login_code: 10 * 60 * 1000,
};

/** Intervalo mínimo entre dois e-mails do mesmo tipo para a mesma pessoa (protege a cota diária). */
export const RESEND_INTERVAL_MS = 60 * 1000;

export interface EmailTokenDeps {
  authTokens: AuthTokenRepository;
  tokens: TokenService;
  email: EmailSender;
  clock: Clock;
  appUrl: string;
}

/**
 * Cria um token de uso único para o link do e-mail. Os anteriores do mesmo tipo deixam de valer,
 * então só o último link enviado funciona.
 */
export async function issueLinkToken(deps: EmailTokenDeps, user: Pick<User, "id">, purpose: AuthTokenPurpose, data?: Record<string, string>) {
  const { token, hash } = deps.tokens.generateRefreshToken();
  await deps.authTokens.invalidate(user.id, purpose);
  await deps.authTokens.create({ userId: user.id, purpose, tokenHash: hash, expiresAt: new Date(deps.clock.now().getTime() + TOKEN_TTL[purpose]), data });
  return token;
}

export async function sentRecently(deps: EmailTokenDeps, userId: string, purpose: AuthTokenPurpose) {
  const last = await deps.authTokens.lastCreatedAt(userId, purpose);
  return last !== null && deps.clock.now().getTime() - last.getTime() < RESEND_INTERVAL_MS;
}

/**
 * Envia sem deixar a falha chegar na resposta: em rotas que não podem revelar se o e-mail existe,
 * um erro só para contas existentes entregaria a informação.
 */
export async function sendQuietly(email: EmailSender, message: EmailMessage) {
  try {
    await email.send(message);
  } catch (err) {
    console.error("Falha ao enviar e-mail:", err instanceof Error ? err.message : err);
  }
}
