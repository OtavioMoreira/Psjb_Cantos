import { z } from "zod";
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
