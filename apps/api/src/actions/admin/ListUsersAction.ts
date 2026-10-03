import { toUserDTO, type ListUsersQuery, type UserDTO } from "../../dtos/user.dto.js";
import type { UserRepository } from "../../interfaces/index.js";

/** Lista para o admin: pendentes primeiro, depois bloqueados e ativos (a ordem vem do repositório). */
export class ListUsersAction {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(query: ListUsersQuery): Promise<UserDTO[]> {
    return (await this.deps.users.list(query)).map(toUserDTO);
  }
}
