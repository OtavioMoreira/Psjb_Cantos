import { z } from "zod";
import type { Movement } from "../domain/movement.js";

export const movementBodySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do movimento.").max(120),
});

export const movementIdParamSchema = z.object({ id: z.coerce.number().int().positive("ID inválido.") });

export interface MovementDTO {
  id: number;
  name: string;
  members: number;
}

export const toMovementDTO = (m: Movement): MovementDTO => ({ id: m.id, name: m.name, members: m.members });
