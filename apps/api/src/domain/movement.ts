/** Movimento ou pastoral da paróquia. Uma pessoa pode participar de vários. */
export interface Movement {
  id: number;
  name: string;
  /** Quantas pessoas estão neste movimento. */
  members: number;
  createdAt: Date;
}
