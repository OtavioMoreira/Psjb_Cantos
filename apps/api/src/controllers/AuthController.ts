import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { loginSchema, type AuthResultDTO } from "../dtos/auth.dto.js";
import type { IssuedSession } from "../actions/auth/issueSession.js";
import type { UserDTO } from "../dtos/user.dto.js";
import { validate } from "../http/validate.js";

export const REFRESH_COOKIE = "psjb_refresh";
// O cookie só viaja nas rotas de sessão, nunca no resto da API.
const COOKIE_PATH = "/api/auth";

export class AuthController {
  constructor(private readonly c: Container) {}

  login = async (req: FastifyRequest, reply: FastifyReply): Promise<AuthResultDTO> => {
    const input = validate(loginSchema, req.body);
    const result = await this.c.actions.login.execute(input, { userAgent: req.headers["user-agent"] ?? null });
    return this.respond(reply, result);
  };

  refresh = async (req: FastifyRequest, reply: FastifyReply): Promise<AuthResultDTO> => {
    try {
      const result = await this.c.actions.refresh.execute(req.cookies[REFRESH_COOKIE], { userAgent: req.headers["user-agent"] ?? null });
      return this.respond(reply, result);
    } catch (err) {
      reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
      throw err;
    }
  };

  logout = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.logout.execute(req.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return reply.status(204).send();
  };

  private respond(reply: FastifyReply, result: IssuedSession & { user: UserDTO }): AuthResultDTO {
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: this.c.env.NODE_ENV === "production",
      sameSite: "lax",
      path: COOKIE_PATH,
      ...(result.remember && { expires: result.refreshExpiresAt }),
    });
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }
}
