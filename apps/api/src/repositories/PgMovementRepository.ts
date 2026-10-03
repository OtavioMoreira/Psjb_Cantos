import { AppError } from "../domain/errors.js";
import type { Movement } from "../domain/movement.js";
import type { MovementRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface MovementRow {
  id: number;
  name: string;
  members: string; // count() vem como bigint → string no pg
  created_at: Date;
}

const SELECT = `
  SELECT mv.id, mv.name, mv.created_at, count(u.id) AS members
  FROM movements mv LEFT JOIN users u ON u.movement_id = mv.id`;

const toMovement = (r: MovementRow): Movement => ({ id: r.id, name: r.name, members: Number(r.members), createdAt: r.created_at });

const taken = () => new AppError("MOVEMENT_TAKEN", "Já existe um movimento com este nome.");

export class PgMovementRepository implements MovementRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const { rows } = await this.pool.query<MovementRow>(`${SELECT} GROUP BY mv.id ORDER BY mv.name`);
    return rows.map(toMovement);
  }

  async findById(id: number) {
    const { rows } = await this.pool.query<MovementRow>(`${SELECT} WHERE mv.id = $1 GROUP BY mv.id`, [id]);
    return rows[0] ? toMovement(rows[0]) : null;
  }

  async create(name: string) {
    try {
      const { rows } = await this.pool.query<{ id: number }>("INSERT INTO movements (name) VALUES ($1) RETURNING id", [name]);
      return (await this.findById(rows[0].id))!;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw taken();
      throw err;
    }
  }

  async rename(id: number, name: string) {
    try {
      const { rowCount } = await this.pool.query("UPDATE movements SET name = $2, updated_at = now() WHERE id = $1", [id, name]);
      return rowCount ? this.findById(id) : null;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw taken();
      throw err;
    }
  }

  async delete(id: number) {
    try {
      const { rowCount } = await this.pool.query("DELETE FROM movements WHERE id = $1", [id]);
      return Boolean(rowCount);
    } catch (err) {
      // FK users.movement_id é RESTRICT (erro 23001; 23503 se um dia virar NO ACTION).
      if (["23001", "23503"].includes((err as { code?: string }).code ?? ""))
        throw new AppError("MOVEMENT_IN_USE", "Há pessoas neste movimento. Troque o movimento delas antes de excluir.");
      throw err;
    }
  }
}
