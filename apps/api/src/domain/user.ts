// Núcleo do domínio: não depende de Fastify, Postgres nem de nenhuma biblioteca.

export const ROLES = ["admin", "musico"] as const;
export type Role = (typeof ROLES)[number];

/** pending = criou a conta e aguarda um admin ativar. Só "active" entra. */
export const USER_STATUSES = ["pending", "active", "blocked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface MovementRef {
  id: number;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  movement: MovementRef | null;
  status: UserStatus;
  blockedReason: string | null;
  roles: Role[];
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Usuário com o hash da senha. Só circula entre actions e repositório, nunca sai na resposta. */
export interface UserWithPassword extends User {
  passwordHash: string;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const hasRole = (user: Pick<User, "roles">, role: Role) => user.roles.includes(role);
