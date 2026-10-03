import { AppError } from "../../domain/errors.js";
import { toUserDTO, type CreateUserInput, type UserDTO } from "../../dtos/user.dto.js";
import type { MovementRepository, PasswordHasher, UserRepository } from "../../interfaces/index.js";

/** Cadastro público: a conta nasce pendente, com papel músico, e só entra depois que um admin ativar. */
export class CreateUserAction {
  constructor(private readonly deps: { users: UserRepository; movements: MovementRepository; hasher: PasswordHasher }) {}

  async execute(input: CreateUserInput): Promise<UserDTO> {
    if (await this.deps.users.emailExists(input.email))
      throw new AppError("EMAIL_TAKEN", "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.");

    if (input.movementId !== null && !(await this.deps.movements.findById(input.movementId)))
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { movementId: "Movimento não encontrado." } });

    const user = await this.deps.users.create({
      name: input.name,
      email: input.email,
      passwordHash: await this.deps.hasher.hash(input.password),
      phone: input.phone,
      movementId: input.movementId,
      status: "pending",
      roles: ["musico"],
    });
    return toUserDTO(user);
  }
}
