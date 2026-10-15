import { AppError } from "../../domain/errors.js";
import { toUserDTO, type ChangePasswordInput, type UserDTO } from "../../dtos/user.dto.js";
import type { PasswordHasher, SessionRepository, TokenService, TrustedDeviceRepository, UserRepository } from "../../interfaces/index.js";

/**
 * Troca a senha exigindo a atual. As sessões dos outros aparelhos são revogadas; a deste
 * aparelho (identificada pelo cookie do refresh) continua valendo. Os aparelhos confiáveis do 2FA
 * perdem a confiança: no próximo login, o código volta a ser pedido.
 */
export class ChangePasswordAction {
  constructor(
    private readonly deps: { users: UserRepository; sessions: SessionRepository; trustedDevices: TrustedDeviceRepository; hasher: PasswordHasher; tokens: TokenService },
  ) {}

  async execute(userId: string, input: ChangePasswordInput, refreshToken: string | undefined): Promise<UserDTO> {
    const user = await this.deps.users.findByIdWithPassword(userId);
    if (!user || user.status !== "active") throw new AppError("UNAUTHORIZED", "Sessão expirada. Entre de novo.");
    if (!(await this.deps.hasher.verify(user.passwordHash, input.currentPassword)))
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { currentPassword: "Senha atual incorreta." } });
    if (input.currentPassword === input.newPassword)
      throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { newPassword: "A nova senha precisa ser diferente da atual." } });

    await this.deps.users.updatePassword(userId, await this.deps.hasher.hash(input.newPassword), false);

    const current = refreshToken ? await this.deps.sessions.findByTokenHash(this.deps.tokens.hashRefreshToken(refreshToken)) : null;
    if (current && current.userId === userId) await this.deps.sessions.revokeOthers(userId, current.familyId);
    else await this.deps.sessions.revokeAllForUser(userId);
    await this.deps.trustedDevices.revokeAllForUser(userId);

    const { passwordHash: _h, ...pub } = user;
    return toUserDTO({ ...pub, mustChangePassword: false });
  }
}
