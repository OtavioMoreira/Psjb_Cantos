import { z } from "zod";
import { ROLES, USER_STATUSES, type User } from "../domain/user.js";

// Mesma regra da tela de cadastro: 8+ caracteres, com letras e números.
export const passwordSchema = z
  .string()
  .min(8, "Use pelo menos 8 caracteres.")
  .max(200)
  .regex(/[A-Za-z]/, "A senha precisa ter letras.")
  .regex(/\d/, "A senha precisa ter números.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.").max(254)),
  password: passwordSchema,
  phone: optionalText(20).refine((v) => v === null || /^[\d\s()+-]{8,20}$/.test(v), "Telefone inválido."),
  movementId: z.coerce.number().int().positive().optional().nullable().transform((v) => v ?? null),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const listUsersQuerySchema = z.object({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
  q: z.string().trim().max(100).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userIdParamSchema = z.object({ id: z.uuid("ID inválido.") });

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Formato público do usuário: sem hash de senha. Datas em ISO 8601. */
export interface UserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  movement: User["movement"];
  status: User["status"];
  blockedReason: string | null;
  roles: User["roles"];
  lastLoginAt: string | null;
  createdAt: string;
}

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    photoUrl: u.photoUrl,
    movement: u.movement,
    status: u.status,
    blockedReason: u.blockedReason,
    roles: u.roles,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
