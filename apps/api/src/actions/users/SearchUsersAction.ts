import type { UserRepository } from "../../interfaces/index.js";

export interface PersonSearchDTO {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  movement: string | null;
}

/** Busca pessoas ativas para compartilhar uma missa. Qualquer pessoa logada pode buscar. */
export class SearchUsersAction {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(userId: string, q: string, limit: number): Promise<PersonSearchDTO[]> {
    return this.deps.users.searchActive(q, userId, limit);
  }
}
