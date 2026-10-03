import { AppError } from "../domain/errors.js";
import type { Flag, FlagGroup } from "../domain/song.js";
import type { FlagData, FlagRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface FlagRow {
  id: number;
  group_name: FlagGroup;
  slug: string;
  name: string;
  color: string | null;
  position: number;
  songs: string;
}

const SELECT = `
  SELECT f.id, f.group_name, f.slug, f.name, f.color, f.position, count(sf.song_id) AS songs
  FROM flags f LEFT JOIN song_flags sf ON sf.flag_id = f.id`;
const ORDER = "ORDER BY array_position(ARRAY['momento','tempo','ano','tema','outro']::varchar[], f.group_name), f.position, f.name";

const toFlag = (r: FlagRow): Flag => ({
  id: r.id,
  group: r.group_name,
  slug: r.slug,
  name: r.name,
  color: r.color,
  position: r.position,
  songs: Number(r.songs),
});

const taken = () => new AppError("FLAG_TAKEN", "Já existe uma flag com este identificador neste grupo.");
const isUnique = (err: unknown) => (err as { code?: string }).code === "23505";

export class PgFlagRepository implements FlagRepository {
  constructor(private readonly pool: Pool) {}

  async list() {
    const { rows } = await this.pool.query<FlagRow>(`${SELECT} GROUP BY f.id ${ORDER}`);
    return rows.map(toFlag);
  }

  async findByIds(ids: number[]) {
    if (!ids.length) return [];
    const { rows } = await this.pool.query<FlagRow>(`${SELECT} WHERE f.id = ANY($1::int[]) GROUP BY f.id ${ORDER}`, [ids]);
    return rows.map(toFlag);
  }

  async create(d: FlagData) {
    try {
      const { rows } = await this.pool.query<{ id: number }>(
        "INSERT INTO flags (group_name, slug, name, color, position) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [d.group, d.slug, d.name, d.color, d.position],
      );
      return (await this.findByIds([rows[0].id]))[0];
    } catch (err) {
      if (isUnique(err)) throw taken();
      throw err;
    }
  }

  async update(id: number, d: FlagData) {
    try {
      const { rowCount } = await this.pool.query(
        "UPDATE flags SET group_name = $2, slug = $3, name = $4, color = $5, position = $6, updated_at = now() WHERE id = $1",
        [id, d.group, d.slug, d.name, d.color, d.position],
      );
      return rowCount ? (await this.findByIds([id]))[0] : null;
    } catch (err) {
      if (isUnique(err)) throw taken();
      throw err;
    }
  }

  async delete(id: number) {
    const { rowCount } = await this.pool.query("DELETE FROM flags WHERE id = $1", [id]);
    return Boolean(rowCount);
  }
}
