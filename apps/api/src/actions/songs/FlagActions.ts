import { AppError } from "../../domain/errors.js";
import { toFlagDTO, type FlagDTO } from "../../dtos/song.dto.js";
import type { FlagData, FlagRepository } from "../../interfaces/index.js";

type Deps = { flags: FlagRepository };

/** Lista pública (filtros do repertório), em ordem: momento, tempo, ano, tema, outro. */
export class ListFlagsAction {
  constructor(private readonly deps: Deps) {}
  async execute(): Promise<FlagDTO[]> {
    return (await this.deps.flags.list()).map(toFlagDTO);
  }
}

export class CreateFlagAction {
  constructor(private readonly deps: Deps) {}
  async execute(data: FlagData): Promise<FlagDTO> {
    return toFlagDTO(await this.deps.flags.create(data));
  }
}

export class UpdateFlagAction {
  constructor(private readonly deps: Deps) {}
  async execute(id: number, data: FlagData): Promise<FlagDTO> {
    const flag = await this.deps.flags.update(id, data);
    if (!flag) throw new AppError("NOT_FOUND", "Flag não encontrada.");
    return toFlagDTO(flag);
  }
}

/** Excluir a flag tira a etiqueta dos cantos (os cantos continuam). */
export class DeleteFlagAction {
  constructor(private readonly deps: Deps) {}
  async execute(id: number): Promise<void> {
    if (!(await this.deps.flags.delete(id))) throw new AppError("NOT_FOUND", "Flag não encontrada.");
  }
}
