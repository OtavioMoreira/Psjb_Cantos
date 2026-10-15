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

const nameSchema = z.string().trim().min(3, "Informe seu nome completo.").max(120);
const emailSchema = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido.").max(254));
const phoneSchema = optionalText(20).refine((v) => v === null || /^[\d\s()+-]{8,20}$/.test(v), "Telefone inválido.");
const movementIdSchema = z.coerce.number().int().positive().optional().nullable().transform((v) => v ?? null);

export const createUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  movementId: movementIdSchema,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * PATCH /api/me: só os campos enviados mudam. O e-mail fica de fora: trocar exige confirmar
 * o novo endereço, o que depende do serviço de e-mail.
 */
export const updateMeSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    movementId: movementIdSchema,
    parish: optionalText(120),
    instrument: optionalText(60),
  })
  .partial()
  .strict();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual.").max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** POST /api/me/email: o novo endereço só vale depois de confirmado pelo link. */
export const changeEmailSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(200),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

/** PATCH /api/admin/users/:id: o admin edita nome, e-mail, movimento e papéis. */
export const adminUpdateUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    movementId: movementIdSchema,
    roles: z
      .array(z.enum(ROLES))
      .min(1, "Escolha pelo menos um papel.")
      .transform((r) => [...new Set(r)]),
  })
  .partial()
  .strict();
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

/** POST /api/admin/users/invite: a pessoa cria a senha pelo link do e-mail. */
export const inviteUserSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    movementId: movementIdSchema,
    roles: z
      .array(z.enum(ROLES))
      .min(1, "Escolha pelo menos um papel.")
      .default(["musico"])
      .transform((r) => [...new Set(r)]),
  })
  .strict();
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const blockUserSchema = z.object({
  reason: optionalText(300),
});

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
  parish: string | null;
  instrument: string | null;
  status: User["status"];
  blockedReason: string | null;
  roles: User["roles"];
  mustChangePassword: boolean;
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
    parish: u.parish,
    instrument: u.instrument,
    status: u.status,
    blockedReason: u.blockedReason,
    roles: u.roles,
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}
