import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import {
  createMassSchema,
  joinBodySchema,
  listMassesQuerySchema,
  massBodySchema,
  massIdParamSchema,
  massPatchSchema,
  shareBodySchema,
  type MassDTO,
} from "../dtos/mass.dto.js";
import { validate } from "../http/validate.js";
import { requireAuth } from "../middlewares/auth.js";

/** Rotas de missa. Todas passam por authenticate; a permissão (dono/convidado) é conferida nas actions. */
export class MassController {
  constructor(private readonly c: Container) {}

  private id = (req: FastifyRequest) => validate(massIdParamSchema, req.params).id;

  list = async (req: FastifyRequest): Promise<{ masses: MassDTO[] }> => {
    const filters = validate(listMassesQuerySchema, req.query);
    return { masses: await this.c.actions.listMasses.execute(requireAuth(req).userId, filters) };
  };

  get = async (req: FastifyRequest): Promise<{ mass: MassDTO }> => {
    return { mass: await this.c.actions.getMass.execute(requireAuth(req).userId, this.id(req)) };
  };

  create = async (req: FastifyRequest, reply: FastifyReply) => {
    const mass = await this.c.actions.createMass.execute(requireAuth(req).userId, validate(createMassSchema, req.body));
    return reply.status(201).send({ mass });
  };

  replace = async (req: FastifyRequest): Promise<{ mass: MassDTO }> => {
    const body = validate(massBodySchema, req.body);
    return { mass: await this.c.actions.updateMass.execute(requireAuth(req).userId, this.id(req), body) };
  };

  patch = async (req: FastifyRequest): Promise<{ mass: MassDTO }> => {
    const changes = validate(massPatchSchema, req.body);
    return { mass: await this.c.actions.updateMass.execute(requireAuth(req).userId, this.id(req), changes) };
  };

  remove = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.deleteMass.execute(requireAuth(req).userId, this.id(req));
    return reply.status(204).send();
  };

  duplicate = async (req: FastifyRequest, reply: FastifyReply) => {
    const mass = await this.c.actions.duplicateMass.execute(requireAuth(req).userId, this.id(req));
    return reply.status(201).send({ mass });
  };

  share = async (req: FastifyRequest): Promise<{ mass: MassDTO }> => {
    const { userIds } = validate(shareBodySchema, req.body);
    return { mass: await this.c.actions.shareMass.execute(requireAuth(req).userId, this.id(req), userIds) };
  };

  /** Gera (ou devolve) o link de convite. */
  createLink = async (req: FastifyRequest) => {
    return this.c.actions.createShareLink.execute(requireAuth(req).userId, this.id(req));
  };

  revokeLink = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.revokeShareLink.execute(requireAuth(req).userId, this.id(req));
    return reply.status(204).send();
  };

  /** Quem abriu o link de convite vira convidado da missa. */
  join = async (req: FastifyRequest): Promise<{ mass: MassDTO }> => {
    const { token } = validate(joinBodySchema, req.body);
    return { mass: await this.c.actions.joinMass.execute(requireAuth(req).userId, token) };
  };

  leave = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.leaveMass.execute(requireAuth(req).userId, this.id(req));
    return reply.status(204).send();
  };
}
