import { createHash, randomBytes, randomInt } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import type { User } from "../../domain/user.js";
import type { ResendCodeInput, VerifyCodeInput } from "../../dtos/auth.dto.js";
import { loginCodeEmail } from "../../emails/templates.js";
import type { AuthToken } from "../../interfaces/index.js";
import { RESEND_INTERVAL_MS, TOKEN_TTL } from "./emailTokens.js";
import { ensureCanEnter, finishLogin, type LoggedIn, type LoginDeps } from "./LoginAction.js";

/** Máximo de códigos errados por desafio; depois, é preciso entrar de novo com a senha. */
export const MAX_CODE_ATTEMPTS = 5;
/** "Confiar neste aparelho": dispensa o código por 30 dias. */
export const TRUSTED_DEVICE_DAYS = 30;

export interface LoginChallenge {
  challengeId: string;
  /** E-mail mascarado ("m***@gmail.com") para a tela dizer para onde foi o código. */
  emailHint: string;
  expiresIn: number;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

// O código vai para o banco com sal: o hash muda a cada desafio, e o código em si não fica guardado.
const codeHash = (salt: string, code: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");

/** Gera o código de 6 dígitos (10 min), invalida os anteriores e manda por e-mail. */
export async function sendLoginCode(deps: LoginDeps, user: User, remember: boolean): Promise<LoginChallenge> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  await deps.authTokens.invalidate(user.id, "login_code");
  const ttl = TOKEN_TTL.login_code;
  const token = await deps.authTokens.create({
    userId: user.id,
    purpose: "login_code",
    tokenHash: codeHash(salt, code),
    expiresAt: new Date(deps.clock.now().getTime() + ttl),
    data: { salt, remember: String(remember) },
  });
  try {
    await deps.email.send(loginCodeEmail({ to: user.email, name: user.name, code }));
  } catch (err) {
    console.error("Falha ao enviar e-mail:", err instanceof Error ? err.message : err);
    await deps.authTokens.invalidate(user.id, "login_code");
    throw new AppError("EMAIL_FAILED", "Não conseguimos enviar o código agora. Tente entrar de novo em instantes.");
  }
  return { challengeId: token.id, emailHint: maskEmail(user.email), expiresIn: ttl / 1000 };
}

const expired = () => new AppError("INVALID_TOKEN", "O código expirou. Entre de novo para receber outro.");

/** Desafio ainda aberto (não usado, dentro da validade e com tentativas sobrando). */
async function openChallenge(deps: LoginDeps, challengeId: string): Promise<AuthToken> {
  const t = await deps.authTokens.findById(challengeId);
  if (!t || t.purpose !== "login_code" || t.usedAt || t.expiresAt <= deps.clock.now() || t.attempts >= MAX_CODE_ATTEMPTS) throw expired();
  return t;
}

/** Segunda etapa: confere o código e abre a sessão. Pode marcar o aparelho como confiável. */
export class VerifyLoginCodeAction {
  constructor(private readonly deps: LoginDeps) {}

  async execute(input: VerifyCodeInput, ctx: { userAgent: string | null }): Promise<LoggedIn & { deviceToken: string | null; deviceExpiresAt: Date | null }> {
    const t = await openChallenge(this.deps, input.challengeId);

    const expected = codeHash(t.data.salt ?? "", input.code);
    // consume só passa com o hash certo (o sal é deste desafio), e de forma atômica: o mesmo código não abre duas sessões.
    const used = await this.deps.authTokens.consume(expected, ["login_code"], this.deps.clock.now());
    if (!used || used.id !== t.id) {
      const attempts = await this.deps.authTokens.addAttempt(t.id);
      if (attempts >= MAX_CODE_ATTEMPTS) throw new AppError("INVALID_TOKEN", "Muitas tentativas erradas. Entre de novo para receber outro código.");
      throw new AppError("INVALID_CODE", "Código incorreto. Confira o e-mail e tente de novo.", { attemptsLeft: MAX_CODE_ATTEMPTS - attempts });
    }

    // A conta pode ter sido bloqueada entre a senha e o código.
    const user = await this.deps.users.findByIdWithPassword(t.userId);
    if (!user) throw expired();
    ensureCanEnter(user);

    const session = await finishLogin(this.deps, user, t.data.remember === "true", ctx.userAgent);
    if (!input.trustDevice) return { ...session, deviceToken: null, deviceExpiresAt: null };

    const { token, hash } = this.deps.tokens.generateRefreshToken();
    const expiresAt = new Date(this.deps.clock.now().getTime() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
    await this.deps.trustedDevices.create({ userId: user.id, tokenHash: hash, expiresAt, userAgent: ctx.userAgent });
    return { ...session, deviceToken: token, deviceExpiresAt: expiresAt };
  }
}

/** Manda um código novo (no máximo 1 por minuto). O anterior deixa de valer. */
export class ResendLoginCodeAction {
  constructor(private readonly deps: LoginDeps) {}

  async execute(input: ResendCodeInput): Promise<LoginChallenge> {
    const t = await openChallenge(this.deps, input.challengeId);
    const wait = RESEND_INTERVAL_MS - (this.deps.clock.now().getTime() - t.createdAt.getTime());
    if (wait > 0) throw new AppError("TOO_SOON", "Aguarde um pouco para pedir outro código.", { retryAfter: Math.ceil(wait / 1000) });
    const user = await this.deps.users.findByIdWithPassword(t.userId);
    if (!user) throw expired();
    ensureCanEnter(user);
    return sendLoginCode(this.deps, user, t.data.remember === "true");
  }
}
