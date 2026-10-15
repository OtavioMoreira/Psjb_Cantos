import { AppError } from "../../domain/errors.js";
import type { ForgotPasswordInput, ResetPasswordInput } from "../../dtos/auth.dto.js";
import { passwordResetEmail } from "../../emails/templates.js";
import type { PasswordHasher, SessionRepository, TrustedDeviceRepository, UserRepository } from "../../interfaces/index.js";
import { issueLinkToken, sendQuietly, sentRecently, type EmailTokenDeps } from "./emailTokens.js";

interface Deps extends EmailTokenDeps {
  users: UserRepository;
  sessions: SessionRepository;
  trustedDevices: TrustedDeviceRepository;
  hasher: PasswordHasher;
}

/**
 * "Esqueci a senha". A resposta é sempre a mesma: nunca revela se o e-mail está cadastrado.
 * Só contas ativas recebem o link (pendente e bloqueado não entrariam de qualquer jeito).
 */
export class RequestPasswordResetAction {
  constructor(private readonly deps: Deps) {}

  async execute(input: ForgotPasswordInput): Promise<void> {
    const user = await this.deps.users.findByEmailWithPassword(input.email);
    if (!user || user.status !== "active") return;
    if (await sentRecently(this.deps, user.id, "password_reset")) return;

    const token = await issueLinkToken(this.deps, user, "password_reset");
    const url = `${this.deps.appUrl}/redefinir-senha?token=${token}`;
    await sendQuietly(this.deps.email, passwordResetEmail({ to: user.email, name: user.name, url }));
  }
}

/**
 * Define a senha pelo link do e-mail (redefinição ou convite). O token é de uso único; as sessões
 * abertas e os aparelhos confiáveis caem, porque quem pede um link novo pode ter perdido o controle da conta.
 * No convite, a conta pendente passa a ativa: foi um admin que convidou.
 */
export class ResetPasswordAction {
  constructor(private readonly deps: Deps) {}

  async execute(input: ResetPasswordInput): Promise<{ email: string }> {
    const token = await this.deps.authTokens.consume(this.deps.tokens.hashRefreshToken(input.token), ["password_reset", "invite"], this.deps.clock.now());
    const user = token && (await this.deps.users.findById(token.userId));
    if (!token || !user) throw new AppError("INVALID_TOKEN", "Link inválido ou expirado. Peça um novo.");

    await this.deps.users.updatePassword(user.id, await this.deps.hasher.hash(input.password), false);
    await this.deps.authTokens.invalidate(user.id, "password_reset");
    await this.deps.sessions.revokeAllForUser(user.id);
    await this.deps.trustedDevices.revokeAllForUser(user.id);
    if (token.purpose === "invite" && user.status === "pending") await this.deps.users.updateStatus(user.id, "active");
    return { email: user.email };
  }
}
