import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { adminUpdateUserSchema, blockUserSchema, listUsersQuerySchema, userIdParamSchema, type UserDTO } from "../dtos/user.dto.js";
import { validate } from "../http/validate.js";
import { requireAuth } from "../middlewares/auth.js";

/** Gestão de usuários. As rotas já passam por authenticate + requireRole("admin"). */
export class AdminUserController {
  constructor(private readonly c: Container) {}

  list = async (req: FastifyRequest): Promise<{ users: UserDTO[] }> => {
    return { users: await this.c.actions.listUsers.execute(validate(listUsersQuerySchema, req.query)) };
  };

  activate = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    const { id } = validate(userIdParamSchema, req.params);
    return { user: await this.c.actions.activateUser.execute(id) };
  };

  update = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    const { id } = validate(userIdParamSchema, req.params);
    return { user: await this.c.actions.adminUpdateUser.execute(requireAuth(req).userId, id, validate(adminUpdateUserSchema, req.body)) };
  };

  block = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    const { id } = validate(userIdParamSchema, req.params);
    const { reason } = validate(blockUserSchema, req.body ?? {});
    return { user: await this.c.actions.blockUser.execute(requireAuth(req).userId, id, reason) };
  };

  unblock = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    const { id } = validate(userIdParamSchema, req.params);
    return { user: await this.c.actions.unblockUser.execute(id) };
  };

  remove = async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = validate(userIdParamSchema, req.params);
    await this.c.actions.deleteUser.execute(requireAuth(req).userId, id);
    return reply.status(204).send();
  };

  /** Senha temporária: vem na resposta uma única vez e não fica guardada em lugar nenhum. */
  resetPassword = async (req: FastifyRequest) => {
    const { id } = validate(userIdParamSchema, req.params);
    return this.c.actions.resetUserPassword.execute(id);
  };
}
