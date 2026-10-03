import { AppError } from "../domain/errors.js";
import type { Mass, MassSlot, PersonRef, SeasonId, YearId } from "../domain/mass.js";
import type { MassData, MassFilters, MassRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface MassRow {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_photo: string | null;
  name: string;
  date: string | null;
  time: string | null;
  season: SeasonId | null;
  liturgical_year: YearId | null;
  slots: MassSlot[];
  shared_with: PersonRef[];
  share_token: string | null;
  created_at: Date;
  updated_at: Date;
}

// Data e hora saem como texto: o driver converteria date em Date no fuso do servidor e erraria o dia.
const SELECT = `
  SELECT ms.id, ms.owner_id, o.name AS owner_name, o.photo_url AS owner_photo, ms.name,
         to_char(ms.celebration_date, 'YYYY-MM-DD') AS date, to_char(ms.celebration_time, 'HH24:MI') AS time,
         ms.season, ms.liturgical_year, ms.slots, ms.share_token, ms.created_at, ms.updated_at,
         COALESCE((
           SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'photoUrl', u.photo_url) ORDER BY u.name)
           FROM mass_shares s JOIN users u ON u.id = s.user_id
           WHERE s.mass_id = ms.id
         ), '[]') AS shared_with
  FROM masses ms
  JOIN users o ON o.id = ms.owner_id`;

const TODAY = "(now() AT TIME ZONE 'America/Sao_Paulo')::date";

const toMass = (r: MassRow): Mass => ({
  id: r.id,
  owner: { id: r.owner_id, name: r.owner_name, photoUrl: r.owner_photo },
  name: r.name,
  date: r.date,
  time: r.time,
  season: r.season,
  year: r.liturgical_year,
  slots: r.slots,
  sharedWith: r.shared_with,
  shareToken: r.share_token,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const values = (d: MassData) => [d.name, d.date, d.time, d.season, d.year, JSON.stringify(d.slots)];

export class PgMassRepository implements MassRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string) {
    const { rows } = await this.pool.query<MassRow>(`${SELECT} WHERE ms.id = $1`, [id]);
    return rows[0] ? toMass(rows[0]) : null;
  }

  async listForUser(userId: string, f: MassFilters) {
    const where = ["(ms.owner_id = $1 OR EXISTS (SELECT 1 FROM mass_shares s WHERE s.mass_id = ms.id AND s.user_id = $1))"];
    const params: unknown[] = [userId];
    if (f.when === "upcoming") where.push(`(ms.celebration_date >= ${TODAY} OR ms.celebration_date IS NULL)`);
    if (f.when === "past") where.push(`ms.celebration_date < ${TODAY}`);
    if (f.q) {
      params.push(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(`ms.name ILIKE $${params.length}`);
    }
    // Próximas: a mais perto primeiro. Passadas e todas: a mais recente primeiro.
    const order =
      f.when === "upcoming"
        ? "ms.celebration_date ASC NULLS LAST, ms.celebration_time ASC NULLS LAST"
        : "ms.celebration_date DESC NULLS FIRST, ms.updated_at DESC";
    const { rows } = await this.pool.query<MassRow>(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order}`, params);
    return rows.map(toMass);
  }

  async create(ownerId: string, data: MassData, id?: string) {
    try {
      const { rows } = await this.pool.query<{ id: string }>(
        `INSERT INTO masses (id, owner_id, name, celebration_date, celebration_time, season, liturgical_year, slots, updated_by)
         VALUES (COALESCE($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8::jsonb, $2) RETURNING id`,
        [id ?? null, ownerId, ...values(data)],
      );
      return (await this.findById(rows[0].id))!;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") throw new AppError("MASS_EXISTS", "Já existe uma missa com este id.");
      throw err;
    }
  }

  async update(id: string, data: MassData, updatedBy: string) {
    const { rowCount } = await this.pool.query(
      `UPDATE masses SET name = $2, celebration_date = $3, celebration_time = $4, season = $5, liturgical_year = $6,
         slots = $7::jsonb, updated_by = $8, updated_at = now()
       WHERE id = $1`,
      [id, ...values(data), updatedBy],
    );
    return rowCount ? this.findById(id) : null;
  }

  async delete(id: string) {
    const { rowCount } = await this.pool.query("DELETE FROM masses WHERE id = $1", [id]);
    return Boolean(rowCount);
  }

  async setShares(id: string, userIds: string[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM mass_shares WHERE mass_id = $1 AND NOT (user_id = ANY($2::uuid[]))", [id, userIds]);
      // Quem já tinha acesso mantém a data original do compartilhamento.
      await client.query(
        "INSERT INTO mass_shares (mass_id, user_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING",
        [id, userIds],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return this.findById(id);
  }

  async removeShare(id: string, userId: string) {
    await this.pool.query("DELETE FROM mass_shares WHERE mass_id = $1 AND user_id = $2", [id, userId]);
  }

  async addShare(id: string, userId: string) {
    await this.pool.query("INSERT INTO mass_shares (mass_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, userId]);
  }

  async findByShareToken(token: string) {
    const { rows } = await this.pool.query<MassRow>(`${SELECT} WHERE ms.share_token = $1`, [token]);
    return rows[0] ? toMass(rows[0]) : null;
  }

  async setShareToken(id: string, token: string | null) {
    await this.pool.query(
      "UPDATE masses SET share_token = $2::text, share_token_created_at = CASE WHEN $2::text IS NULL THEN NULL ELSE now() END WHERE id = $1",
      [id, token],
    );
  }

  async countSongUsage(songId: number) {
    // slots = [{ items: [{ songId }] }]: o operador @> procura o canto em qualquer momento.
    const { rows } = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM masses WHERE slots @> $1::jsonb`,
      [JSON.stringify([{ items: [{ songId }] }])],
    );
    return Number(rows[0].n);
  }
}
