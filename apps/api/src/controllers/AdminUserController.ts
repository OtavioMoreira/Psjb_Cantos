import type { FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { listUsersQuerySchema, userIdParamSchema, type UserDTO } from "../dtos/user.dto.js";
import { validate } from "../http/validate.js";

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
}
