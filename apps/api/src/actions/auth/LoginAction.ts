import { AppError } from "../../domain/errors.js";
import type { UserWithPassword } from "../../domain/user.js";
import type { LoginInput } from "../../dtos/auth.dto.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type {
  AuthTokenRepository,
  Clock,
  EmailSender,
  PasswordHasher,
  SessionRepository,
  TokenService,
  TrustedDeviceRepository,
  UserRepository,
} from "../../interfaces/index.js";
import { issueSession, type IssuedSession, type SessionTtl } from "./issueSession.js";
import { sendLoginCode, type LoginChallenge } from "./TwoFactorActions.js";

export interface LoginDeps {
  users: UserRepository;
  sessions: SessionRepository;
  authTokens: AuthTokenRepository;
  trustedDevices: TrustedDeviceRepository;
  email: EmailSender;
  hasher: PasswordHasher;
  tokens: TokenService;
  clock: Clock;
  ttl: SessionTtl;
  /** Login em duas etapas ligado (env LOGIN_2FA). */
  twoFactor: boolean;
}

export interface LoginContext {
  userAgent: string | null;
  /** Token do cookie "confiar neste aparelho", se houver. */
  deviceToken?: string;
}

export type LoggedIn = IssuedSession & { user: UserDTO };
export type LoginResult = ({ kind: "session" } & LoggedIn) | ({ kind: "challenge" } & LoginChallenge);

/** Abre a sessão depois de tudo conferido (senha e, se for o caso, o código do 2FA). */
export async function finishLogin(deps: LoginDeps, user: UserWithPassword, remember: boolean, userAgent: string | null): Promise<LoggedIn> {
  const session = await issueSession(deps, user, { remember, userAgent });
  await deps.users.touchLastLogin(user.id);
  const { passwordHash: _hash, ...publicUser } = user;
  return { ...session, user: toUserDTO({ ...publicUser, lastLoginAt: deps.clock.now() }) };
}

/** Status só é revelado para quem acertou a senha. */
export function ensureCanEnter(user: UserWithPassword) {
  if (user.status === "pending")
    throw new AppError("ACCOUNT_PENDING", "Sua conta ainda não foi ativada. Aguarde a liberação pela coordenação.");
  if (user.status === "blocked")
    throw new AppError("ACCOUNT_BLOCKED", "Seu acesso está bloqueado. Procure a coordenação da paróquia.", { reason: user.blockedReason });
}

export class LoginAction {
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly deps: LoginDeps) {}

  async execute(input: LoginInput, ctx: LoginContext): Promise<LoginResult> {
    const user = await this.deps.users.findByEmailWithPassword(input.email);

    // Sem usuário, ainda verifica um hash qualquer: o tempo de resposta não revela se o e-mail existe.
    if (!user) {
      this.dummyHash ??= this.deps.hasher.hash("senha-inexistente-0");
      await this.deps.hasher.verify(await this.dummyHash, input.password);
      throw invalid();
    }
    if (!(await this.deps.hasher.verify(user.passwordHash, input.password))) throw invalid();
    ensureCanEnter(user);

    const trusted =
      ctx.deviceToken !== undefined && (await this.deps.trustedDevices.isTrusted(user.id, this.deps.tokens.hashRefreshToken(ctx.deviceToken), this.deps.clock.now()));
    if (this.deps.twoFactor && !trusted) return { kind: "challenge", ...(await sendLoginCode(this.deps, user, input.remember)) };

    return { kind: "session", ...(await finishLogin(this.deps, user, input.remember, ctx.userAgent)) };
  }
}

const invalid = () => new AppError("INVALID_CREDENTIALS", "E-mail ou senha não conferem.");
