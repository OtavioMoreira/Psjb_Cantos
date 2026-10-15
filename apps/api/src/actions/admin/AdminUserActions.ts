import { randomInt } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { hasRole, type User } from "../../domain/user.js";
import { toUserDTO, type AdminUpdateUserInput, type UserDTO } from "../../dtos/user.dto.js";
import type { FileStorage, MovementRepository, PasswordHasher, SessionRepository, TrustedDeviceRepository, UserRepository } from "../../interfaces/index.js";

interface Deps {
  users: UserRepository;
  sessions: SessionRepository;
  trustedDevices: TrustedDeviceRepository;
  movements: MovementRepository;
  hasher: PasswordHasher;
  storage: FileStorage;
}

async function find(users: UserRepository, id: string): Promise<User> {
  const user = await users.findById(id);
  if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
  return user;
}

const isActiveAdmin = (u: User) => u.status === "active" && hasRole(u, "admin");

/** O site nunca fica sem administrador: tirar o último admin ativo é recusado. */
async function ensureAnotherAdmin(users: UserRepository, target: User) {
  if (isActiveAdmin(target) && (await users.countActiveAdmins(target.id)) === 0)
    throw new AppError("LAST_ADMIN", "É preciso ter pelo menos um administrador ativo. Promova outra pessoa antes.");
}

function notSelf(adminId: string, targetId: string, message: string) {
  if (adminId === targetId) throw new AppError("FORBIDDEN", message);
}

/** Admin edita nome, e-mail, telefone, movimento e papéis. Não rebaixa a si mesmo. */
export class AdminUpdateUserAction {
  constructor(private readonly deps: Deps) {}

  async execute(adminId: string, id: string, input: AdminUpdateUserInput): Promise<UserDTO> {
    const target = await find(this.deps.users, id);
    if (input.roles && !input.roles.includes("admin") && hasRole(target, "admin")) {
      notSelf(adminId, id, "Você não pode tirar o próprio papel de administrador.");
      await ensureAnotherAdmin(this.deps.users, target);
    }
    if (input.movementId != null && !(await this.deps.movements.findById(input.movementId)))
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { movementId: "Movimento não encontrado." } });

    const user = await this.deps.users.adminUpdate(id, input);
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
    return toUserDTO(user);
  }
}

/** Bloqueia com motivo (a pessoa vê ao tentar entrar) e derruba as sessões abertas. */
export class BlockUserAction {
  constructor(private readonly deps: Deps) {}

  async execute(adminId: string, id: string, reason: string | null): Promise<UserDTO> {
    notSelf(adminId, id, "Você não pode bloquear a si mesmo.");
    const target = await find(this.deps.users, id);
    await ensureAnotherAdmin(this.deps.users, target);
    const user = await this.deps.users.updateStatus(id, "blocked", reason);
    await this.deps.sessions.revokeAllForUser(id);
    return toUserDTO(user!);
  }
}

/** Libera o acesso. Na API não há confirmação de e-mail, então volta direto para ativo. */
export class UnblockUserAction {
  constructor(private readonly deps: Deps) {}

  async execute(id: string): Promise<UserDTO> {
    const target = await find(this.deps.users, id);
    if (target.status !== "blocked") return toUserDTO(target);
    return toUserDTO((await this.deps.users.updateStatus(id, "active", null))!);
  }
}

/** Exclui a conta. As missas da pessoa são apagadas junto; os convidados perdem o acesso a elas. */
export class DeleteUserAction {
  constructor(private readonly deps: Deps) {}

  async execute(adminId: string, id: string): Promise<void> {
    notSelf(adminId, id, "Você não pode excluir a si mesmo.");
    const target = await find(this.deps.users, id);
    await ensureAnotherAdmin(this.deps.users, target);
    await this.deps.users.delete(id);
    if (target.photoUrl) await this.deps.storage.delete(target.photoUrl).catch(() => undefined);
  }
}

// Sem letras e números que se confundem (0/O, 1/l/I), para ditar ou copiar à mão.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

/** Senha temporária legível, no formato "abcd-2345" (atende à regra de letras + números). */
export function temporaryPassword() {
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[randomInt(chars.length)]).join("");
  return `${pick(ALPHABET, 4)}-${pick(DIGITS, 2)}${pick(ALPHABET + DIGITS, 2)}`;
}

/**
 * Gera uma senha temporária, mostrada uma única vez ao admin. A pessoa é obrigada a trocá-la
 * no próximo acesso, e as sessões abertas caem.
 */
export class ResetUserPasswordAction {
  constructor(private readonly deps: Deps) {}

  async execute(id: string): Promise<{ user: UserDTO; temporaryPassword: string }> {
    const target = await find(this.deps.users, id);
    const password = temporaryPassword();
    await this.deps.users.updatePassword(id, await this.deps.hasher.hash(password), true);
    await this.deps.sessions.revokeAllForUser(id);
    await this.deps.trustedDevices.revokeAllForUser(id);
    return { user: toUserDTO({ ...target, mustChangePassword: true }), temporaryPassword: password };
  }
}
