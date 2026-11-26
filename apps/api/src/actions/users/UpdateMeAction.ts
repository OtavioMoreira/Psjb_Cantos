import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UpdateMeInput, type UserDTO } from "../../dtos/user.dto.js";
import { ensureMovementsExist } from "../movements/MovementActions.js";
import type { MovementRepository, UserRepository } from "../../interfaces/index.js";

/** A própria pessoa edita nome, telefone, movimentos, paróquia e instrumento. */
export class UpdateMeAction {
  constructor(private readonly deps: { users: UserRepository; movements: MovementRepository }) {}

  async execute(userId: string, input: UpdateMeInput): Promise<UserDTO> {
    await ensureMovementsExist(this.deps.movements, input.movementIds);

    const user = await this.deps.users.updateProfile(userId, input);
    if (!user || user.status !== "active") throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    return toUserDTO(user);
  }
}
