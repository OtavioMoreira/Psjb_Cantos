import { AppError } from "../../domain/errors.js";
import { toMovementDTO, type MovementDTO } from "../../dtos/movement.dto.js";
import type { MovementRepository } from "../../interfaces/index.js";

type Deps = { movements: MovementRepository };

/** Lista pública: alimenta o campo "Movimento" do cadastro. */
export class ListMovementsAction {
  constructor(private readonly deps: Deps) {}
  async execute(): Promise<MovementDTO[]> {
    return (await this.deps.movements.list()).map(toMovementDTO);
  }
}

export class CreateMovementAction {
  constructor(private readonly deps: Deps) {}
  async execute(name: string): Promise<MovementDTO> {
    return toMovementDTO(await this.deps.movements.create(name));
  }
}

export class RenameMovementAction {
  constructor(private readonly deps: Deps) {}
  async execute(id: number, name: string): Promise<MovementDTO> {
    const m = await this.deps.movements.rename(id, name);
    if (!m) throw new AppError("NOT_FOUND", "Movimento não encontrado.");
    return toMovementDTO(m);
  }
}

/** Bloqueado se houver pessoas no movimento (MOVEMENT_IN_USE). */
export class DeleteMovementAction {
  constructor(private readonly deps: Deps) {}
  async execute(id: number): Promise<void> {
    if (!(await this.deps.movements.delete(id))) throw new AppError("NOT_FOUND", "Movimento não encontrado.");
  }
}
