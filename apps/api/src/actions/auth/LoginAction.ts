import { AppError } from "../../domain/errors.js";
import type { LoginInput } from "../../dtos/auth.dto.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type { Clock, PasswordHasher, SessionRepository, TokenService, UserRepository } from "../../interfaces/index.js";
import { issueSession, type IssuedSession, type SessionTtl } from "./issueSession.js";

export interface LoginDeps {
  users: UserRepository;
  sessions: SessionRepository;
  hasher: PasswordHasher;
  tokens: TokenService;
  clock: Clock;
  ttl: SessionTtl;
}

export class LoginAction {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: LoginDeps) {}

  async execute(input: LoginInput, ctx: { userAgent: string | null }): Promise<IssuedSession & { user: UserDTO }> {
    const user = await this.deps.users.findByEmailWithPassword(input.email);

    // Sem usuário, ainda verifica um hash qualquer: o tempo de resposta não revela se o e-mail existe.
    if (!user) {
      this.dummyHash ??= this.deps.hasher.hash("senha-inexistente-0");
      await this.deps.hasher.verify(await this.dummyHash, input.password);
      throw invalid();
    }
    if (!(await this.deps.hasher.verify(user.passwordHash, input.password))) throw invalid();

    // Status só é revelado para quem acertou a senha.
    if (user.status === "pending")
      throw new AppError("ACCOUNT_PENDING", "Sua conta ainda não foi ativada. Aguarde a liberação pela coordenação.");
    if (user.status === "blocked")
      throw new AppError("ACCOUNT_BLOCKED", "Seu acesso está bloqueado. Procure a coordenação da paróquia.", {
        reason: user.blockedReason,
      });

    const session = await issueSession(this.deps, user, { remember: input.remember, userAgent: ctx.userAgent });
    await this.deps.users.touchLastLogin(user.id);
    const { passwordHash: _hash, ...publicUser } = user;
    return { ...session, user: toUserDTO({ ...publicUser, lastLoginAt: this.deps.clock.now() }) };
  }
}

const invalid = () => new AppError("INVALID_CREDENTIALS", "E-mail ou senha não conferem.");
