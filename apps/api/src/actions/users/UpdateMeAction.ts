import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UpdateMeInput, type UserDTO } from "../../dtos/user.dto.js";
import type { MovementRepository, UserRepository } from "../../interfaces/index.js";

/** A própria pessoa edita nome, telefone, movimento, paróquia e instrumento. */
export class UpdateMeAction {
  constructor(private readonly deps: { users: UserRepository; movements: MovementRepository }) {}

  async execute(userId: string, input: UpdateMeInput): Promise<UserDTO> {
    if (input.movementId != null && !(await this.deps.movements.findById(input.movementId)))
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { movementId: "Movimento não encontrado." } });

    const user = await this.deps.users.updateProfile(userId, input);
    if (!user || user.status !== "active") throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    return toUserDTO(user);
  }
}
