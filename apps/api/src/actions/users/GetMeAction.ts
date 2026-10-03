import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type { UserRepository } from "../../interfaces/index.js";

export class GetMeAction {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(userId: string): Promise<UserDTO> {
    const user = await this.deps.users.findById(userId);
    // Conta removida ou bloqueada depois do login: o access token deixa de valer.
    if (!user || user.status !== "active") throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    return toUserDTO(user);
  }
}
