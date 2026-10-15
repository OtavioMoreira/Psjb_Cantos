import { z } from "zod";
import { passwordSchema } from "./user.dto.js";
import type { UserDTO } from "./user.dto.js";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
  password: z.string().min(1, "Informe a senha.").max(200),
  remember: z.boolean().default(true),
});
export type LoginInput = z.infer<typeof loginSchema>;

export interface AuthResultDTO {
  accessToken: string;
  /** Segundos até o access token expirar. */
  expiresIn: number;
  user: UserDTO;
}

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.")),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Link inválido.").max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const confirmEmailSchema = z.object({
  token: z.string().min(20, "Link inválido.").max(200),
});

export const verifyCodeSchema = z.object({
  challengeId: z.uuid("Código expirado. Entre de novo."),
  code: z.string().trim().regex(/^\d{6}$/, "O código tem 6 números."),
  trustDevice: z.boolean().default(false),
});
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

export const resendCodeSchema = z.object({
  challengeId: z.uuid("Código expirado. Entre de novo."),
});
export type ResendCodeInput = z.infer<typeof resendCodeSchema>;

/** Senha certa, falta o código enviado por e-mail. */
export interface LoginChallengeDTO {
  twoFactor: true;
  challengeId: string;
  emailHint: string;
  expiresIn: number;
}
