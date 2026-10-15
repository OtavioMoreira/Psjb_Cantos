import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import {
  forgotPasswordSchema,
  loginSchema,
  resendCodeSchema,
  resetPasswordSchema,
  verifyCodeSchema,
  type AuthResultDTO,
  type LoginChallengeDTO,
} from "../dtos/auth.dto.js";
import { changePasswordSchema } from "../dtos/user.dto.js";
import { requireAuth } from "../middlewares/auth.js";
import type { IssuedSession } from "../actions/auth/issueSession.js";
import type { UserDTO } from "../dtos/user.dto.js";
import { validate } from "../http/validate.js";

export const REFRESH_COOKIE = "psjb_refresh";
/** "Confiar neste aparelho": dispensa o código do 2FA. */
export const DEVICE_COOKIE = "psjb_device";
// O cookie só viaja nas rotas de sessão, nunca no resto da API.
const COOKIE_PATH = "/api/auth";

export class AuthController {
  constructor(private readonly c: Container) {}

  /** Com o 2FA ligado (e aparelho não confiável), responde o desafio em vez da sessão. */
  login = async (req: FastifyRequest, reply: FastifyReply): Promise<AuthResultDTO | LoginChallengeDTO> => {
    const input = validate(loginSchema, req.body);
    const result = await this.c.actions.login.execute(input, { userAgent: req.headers["user-agent"] ?? null, deviceToken: req.cookies[DEVICE_COOKIE] });
    if (result.kind === "challenge") return { twoFactor: true, challengeId: result.challengeId, emailHint: result.emailHint, expiresIn: result.expiresIn };
    return this.respond(reply, result);
  };

  verifyCode = async (req: FastifyRequest, reply: FastifyReply): Promise<AuthResultDTO> => {
    const result = await this.c.actions.verifyLoginCode.execute(validate(verifyCodeSchema, req.body), { userAgent: req.headers["user-agent"] ?? null });
    if (result.deviceToken && result.deviceExpiresAt)
      reply.setCookie(DEVICE_COOKIE, result.deviceToken, { ...this.cookieBase(), expires: result.deviceExpiresAt });
    return this.respond(reply, result);
  };

  resendCode = async (req: FastifyRequest): Promise<LoginChallengeDTO> => {
    const result = await this.c.actions.resendLoginCode.execute(validate(resendCodeSchema, req.body));
    return { twoFactor: true, ...result };
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

  /** Fica em /auth para receber o cookie: a sessão deste aparelho continua e as outras caem. */
  changePassword = async (req: FastifyRequest): Promise<{ user: UserDTO }> => {
    const input = validate(changePasswordSchema, req.body);
    return { user: await this.c.actions.changePassword.execute(requireAuth(req).userId, input, req.cookies[REFRESH_COOKIE]) };
  };

  /** Sempre 202 com a mesma mensagem: não revela se o e-mail está cadastrado. */
  forgot = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.requestPasswordReset.execute(validate(forgotPasswordSchema, req.body));
    return reply.status(202).send({ ok: true });
  };

  reset = async (req: FastifyRequest) => {
    return this.c.actions.resetPassword.execute(validate(resetPasswordSchema, req.body));
  };

  private cookieBase() {
    return { httpOnly: true, secure: this.c.env.NODE_ENV === "production", sameSite: "lax" as const, path: COOKIE_PATH };
  }

  private respond(reply: FastifyReply, result: IssuedSession & { user: UserDTO }): AuthResultDTO {
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, {
      ...this.cookieBase(),
      ...(result.remember && { expires: result.refreshExpiresAt }),
    });
    return { accessToken: result.accessToken, expiresIn: result.expiresIn, user: result.user };
  }
}
