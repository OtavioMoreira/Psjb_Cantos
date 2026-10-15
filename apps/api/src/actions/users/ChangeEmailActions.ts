import { AppError } from "../../domain/errors.js";
import type { ChangeEmailInput } from "../../dtos/user.dto.js";
import { emailChangedEmail, emailChangeEmail } from "../../emails/templates.js";
import type { PasswordHasher, UserRepository } from "../../interfaces/index.js";
import { issueLinkToken, sendQuietly, sentRecently, type EmailTokenDeps } from "../auth/emailTokens.js";

interface Deps extends EmailTokenDeps {
  users: UserRepository;
  hasher: PasswordHasher;
}

const fieldError = (field: string, message: string) => new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { [field]: message } });

/**
 * Pede a troca do próprio e-mail. Exige a senha (quem pegou o aparelho destravado não troca o login)
 * e manda um link (24 h) para o endereço novo. Até confirmar, o antigo continua valendo.
 */
export class RequestEmailChangeAction {
  constructor(private readonly deps: Deps) {}

  async execute(userId: string, input: ChangeEmailInput): Promise<void> {
    const user = await this.deps.users.findByIdWithPassword(userId);
    if (!user || user.status !== "active") throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    if (!(await this.deps.hasher.verify(user.passwordHash, input.password))) throw fieldError("password", "Senha incorreta.");
    if (input.email === user.email) throw fieldError("email", "Este já é o seu e-mail.");
    if (await this.deps.users.emailExists(input.email)) throw fieldError("email", "Já existe uma conta com este e-mail.");
    if (await sentRecently(this.deps, user.id, "email_change"))
      throw new AppError("TOO_SOON", "Acabamos de enviar um link. Aguarde um minuto para pedir outro.");

    const token = await issueLinkToken(this.deps, user, "email_change", { newEmail: input.email });
    try {
      await this.deps.email.send(emailChangeEmail({ to: input.email, name: user.name, url: `${this.deps.appUrl}/confirmar-email?token=${token}` }));
    } catch (err) {
      console.error("Falha ao enviar e-mail:", err instanceof Error ? err.message : err);
      await this.deps.authTokens.invalidate(user.id, "email_change");
      throw new AppError("EMAIL_FAILED", "Não foi possível enviar o e-mail agora. Confira o endereço e tente de novo.");
    }
  }
}

/** Confirma pelo link: o e-mail muda, e o endereço antigo recebe um aviso (caso não tenha sido a pessoa). */
export class ConfirmEmailChangeAction {
  constructor(private readonly deps: Deps) {}

  async execute(rawToken: string): Promise<{ email: string }> {
    const token = await this.deps.authTokens.consume(this.deps.tokens.hashRefreshToken(rawToken), ["email_change"], this.deps.clock.now());
    const user = token && (await this.deps.users.findById(token.userId));
    const newEmail = token?.data.newEmail;
    if (!token || !user || !newEmail) throw new AppError("INVALID_TOKEN", "Link inválido ou expirado. Peça a troca de novo no seu perfil.");

    // Outra conta pode ter pegado o endereço entre o pedido e a confirmação: adminUpdate lança EMAIL_TAKEN.
    const updated = await this.deps.users.adminUpdate(user.id, { email: newEmail });
    if (!updated) throw new AppError("INVALID_TOKEN", "Link inválido ou expirado.");
    await sendQuietly(this.deps.email, emailChangedEmail({ to: user.email, name: user.name, newEmail }));
    return { email: newEmail };
  }
}
