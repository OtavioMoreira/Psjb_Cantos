import { AppError } from "../../domain/errors.js";
import type { User } from "../../domain/user.js";
import { toUserDTO, type InviteUserInput, type UserDTO } from "../../dtos/user.dto.js";
import { inviteEmail, passwordResetEmail } from "../../emails/templates.js";
import type { EmailMessage, MovementRepository, PasswordHasher, UserRepository } from "../../interfaces/index.js";
import { issueLinkToken, type EmailTokenDeps } from "../auth/emailTokens.js";

interface Deps extends EmailTokenDeps {
  users: UserRepository;
  movements: MovementRepository;
  hasher: PasswordHasher;
}

/** Aqui o admin precisa saber se o e-mail não saiu, para tentar de novo ou usar a senha temporária. */
async function sendOrFail(deps: Deps, message: EmailMessage) {
  try {
    await deps.email.send(message);
  } catch (err) {
    console.error("Falha ao enviar e-mail:", err instanceof Error ? err.message : err);
    throw new AppError("EMAIL_FAILED", "Não foi possível enviar o e-mail agora. Tente de novo em instantes.");
  }
}

async function sendInvite(deps: Deps, user: User, adminId: string) {
  const admin = await deps.users.findById(adminId);
  const token = await issueLinkToken(deps, user, "invite");
  const url = `${deps.appUrl}/redefinir-senha?token=${token}&convite=1`;
  await sendOrFail(deps, inviteEmail({ to: user.email, name: user.name, invitedBy: admin?.name ?? "A coordenação", url }));
}

/**
 * Convida alguém: a conta nasce pendente, sem senha utilizável, e a pessoa recebe um link (7 dias)
 * para criar a senha. Ao criar, a conta fica ativa.
 */
export class InviteUserAction {
  constructor(private readonly deps: Deps) {}

  async execute(adminId: string, input: InviteUserInput): Promise<UserDTO> {
    if (await this.deps.users.emailExists(input.email)) throw new AppError("EMAIL_TAKEN", "Já existe uma conta com este e-mail.");
    if (input.movementId !== null && !(await this.deps.movements.findById(input.movementId)))
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { movementId: "Movimento não encontrado." } });

    // Senha aleatória que ninguém conhece: até usar o link, não há como entrar.
    const { token: unusable } = this.deps.tokens.generateRefreshToken();
    const user = await this.deps.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.deps.hasher.hash(unusable),
      phone: null,
      movementId: input.movementId,
      status: "pending",
      roles: input.roles,
    });
    await sendInvite(this.deps, user, adminId);
    return toUserDTO(user);
  }
}

/** Reenvia o convite (o link anterior deixa de valer). Só para contas pendentes. */
export class ResendInviteAction {
  constructor(private readonly deps: Deps) {}

  async execute(adminId: string, id: string): Promise<void> {
    const user = await this.deps.users.findById(id);
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
    if (user.status !== "pending") throw new AppError("VALIDATION_ERROR", "Só dá para reenviar o convite de quem ainda não entrou.");
    await sendInvite(this.deps, user, adminId);
  }
}

/** Admin manda o link de redefinição (1 h) para a pessoa criar uma senha nova. Só contas ativas. */
export class SendResetLinkAction {
  constructor(private readonly deps: Deps) {}

  async execute(id: string): Promise<void> {
    const user = await this.deps.users.findById(id);
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
    if (user.status !== "active") throw new AppError("VALIDATION_ERROR", "A conta precisa estar ativa para receber o link.");
    const token = await issueLinkToken(this.deps, user, "password_reset");
    await sendOrFail(this.deps, passwordResetEmail({ to: user.email, name: user.name, url: `${this.deps.appUrl}/redefinir-senha?token=${token}` }));
  }
}
