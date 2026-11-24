import type { UserStatus } from "../../domain/user.js";
import { toUserDTO, type ListUsersQuery, type UserDTO } from "../../dtos/user.dto.js";
import type { UserRepository } from "../../interfaces/index.js";

export interface UserPage {
  users: UserDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** Resumo de todas as contas (sem filtros), para os cartões do admin. */
  counts: Record<UserStatus, number> & { all: number };
}

/** Lista paginada para o admin: pendentes primeiro, depois bloqueados e ativos (a ordem vem do repositório). */
export class ListUsersAction {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(query: ListUsersQuery): Promise<UserPage> {
    const [users, total, byStatus] = await Promise.all([
      this.deps.users.list(query),
      this.deps.users.count(query),
      this.deps.users.countByStatus(),
    ]);
    const all = byStatus.pending + byStatus.active + byStatus.blocked;
    return { users: users.map(toUserDTO), total, page: query.page, pageSize: query.pageSize, counts: { ...byStatus, all } };
  }
}
