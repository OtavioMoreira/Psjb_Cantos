import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import { accountActivatedEmail } from "../../emails/templates.js";
import type { EmailSender, UserRepository } from "../../interfaces/index.js";
import { sendQuietly } from "../auth/emailTokens.js";

/**
 * Admin libera a conta pendente (ou desbloqueia). A partir daí a pessoa consegue entrar.
 * Quem estava aguardando a liberação recebe um aviso por e-mail.
 */
export class ActivateUserAction {
  constructor(private readonly deps: { users: UserRepository; email: EmailSender; appUrl: string }) {}

  async execute(id: string): Promise<UserDTO> {
    const before = await this.deps.users.findById(id);
    const user = before && (await this.deps.users.updateStatus(id, "active", null));
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
    // Falha no aviso não desfaz a ativação: a conta já está liberada.
    if (before.status === "pending")
      await sendQuietly(this.deps.email, accountActivatedEmail({ to: user.email, name: user.name, url: `${this.deps.appUrl}/entrar?email=${encodeURIComponent(user.email)}` }));
    return toUserDTO(user);
  }
}
