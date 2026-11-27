import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { confirmEmailSchema } from "../dtos/auth.dto.js";
import { changeEmailSchema, createUserSchema, searchUsersQuerySchema, updateMeSchema, type UserDTO } from "../dtos/user.dto.js";
import { validate } from "../http/validate.js";
import { requireAuth } from "../middlewares/auth.js";

export class UserController {
  constructor(private readonly c: Container) {}

  /** Cadastro público. Responde 201 com a conta pendente; quem ativa é um admin. */
  create = async (req: FastifyRequest, reply: FastifyReply) => {
    const user = await this.c.actions.createUser.execute(validate(createUserSchema, req.body), { ip: req.ip });
    return reply.status(201).send({ user });
  };

  me = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    return { user: await this.c.actions.getMe.execute(requireAuth(req).userId) };
  };

  updateMe = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    return { user: await this.c.actions.updateMe.execute(requireAuth(req).userId, validate(updateMeSchema, req.body)) };
  };

  /** Manda o link de confirmação para o novo endereço. 202: o e-mail só muda depois do clique. */
  requestEmailChange = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.requestEmailChange.execute(requireAuth(req).userId, validate(changeEmailSchema, req.body));
    return reply.status(202).send({ ok: true });
  };

  /** Pública: quem clica no link pode estar em outro aparelho, sem login. O token é a prova. */
  confirmEmailChange = async (req: FastifyRequest) => {
    return this.c.actions.confirmEmailChange.execute(validate(confirmEmailSchema, req.body).token);
  };

  /** Pessoas ativas para compartilhar missa: GET /api/users/search?q=ana */
  search = async (req: FastifyRequest) => {
    const { q, limit } = validate(searchUsersQuerySchema, req.query);
    return { users: await this.c.actions.searchUsers.execute(requireAuth(req).userId, q, limit) };
  };
}
