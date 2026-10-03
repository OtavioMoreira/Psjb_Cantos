import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type { UserRepository } from "../../interfaces/index.js";

/** Admin libera a conta pendente (ou desbloqueia). A partir daí a pessoa consegue entrar. */
export class ActivateUserAction {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(id: string): Promise<UserDTO> {
    const user = await this.deps.users.updateStatus(id, "active", null);
    if (!user) throw new AppError("NOT_FOUND", "Usuário não encontrado.");
    return toUserDTO(user);
  }
}
