import { AppError } from "../../domain/errors.js";
import type { HumanVerifier } from "../../interfaces/index.js";

/** Janela das senhas erradas que passam a exigir o desafio no login (regras §13). */
export const LOGIN_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILS_BEFORE_CAPTCHA = 3;
export const loginFailKey = (email: string) => `login-fail|${email}`;

/** Exige o desafio resolvido (cadastro, recuperação de senha e login depois de 3 falhas). Desligado sem a chave. */
export async function requireHuman(verifier: HumanVerifier, token: string | undefined, ip: string | null) {
  if (!verifier.enabled) return;
  if (!token || !(await verifier.verify(token, ip)))
    throw new AppError("CAPTCHA_REQUIRED", "Confirme que você não é um robô.", { captcha: true });
}
