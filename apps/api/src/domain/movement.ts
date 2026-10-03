/** Movimento ou pastoral da paróquia. Cada usuário participa de no máximo um. */
export interface Movement {
  id: number;
  name: string;
  /** Quantas pessoas estão neste movimento. */
  members: number;
  createdAt: Date;
}
