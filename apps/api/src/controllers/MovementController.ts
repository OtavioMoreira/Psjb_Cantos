import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { movementBodySchema, movementIdParamSchema, type MovementDTO } from "../dtos/movement.dto.js";
import { validate } from "../http/validate.js";

/** GET é público (cadastro); criar, renomear e excluir ficam sob /admin. */
export class MovementController {
  constructor(private readonly c: Container) {}

  list = async (): Promise<{ movements: MovementDTO[] }> => {
    return { movements: await this.c.actions.listMovements.execute() };
  };

  create = async (req: FastifyRequest, reply: FastifyReply) => {
    const { name } = validate(movementBodySchema, req.body);
    return reply.status(201).send({ movement: await this.c.actions.createMovement.execute(name) });
  };

  rename = async (req: FastifyRequest): Promise<{ movement: MovementDTO }> => {
    const { id } = validate(movementIdParamSchema, req.params);
    const { name } = validate(movementBodySchema, req.body);
    return { movement: await this.c.actions.renameMovement.execute(id, name) };
  };

  remove = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = validate(movementIdParamSchema, req.params);
    await this.c.actions.deleteMovement.execute(id);
    return reply.status(204).send();
  };
}
