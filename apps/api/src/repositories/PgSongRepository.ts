import { AppError } from "../domain/errors.js";
import type { FlagRef, Song, SongMedia } from "../domain/song.js";
import type { SongData, SongFilters, SongRepository } from "../interfaces/index.js";
import type { Pool } from "../database/pool.js";

interface SongRow {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  song_key: string | null;
  lyrics: string;
  audio_url: string | null;
  audiomack_url: string | null;
  cifra_pdf_url: string | null;
  partitura_pdf_url: string | null;
  active: boolean;
  created_at: Date;
  updated_at: Date;
  flags: FlagRef[];
  total?: string;
}

const MEDIA_COLUMN: Record<keyof SongMedia, string> = {
  audio: "audio_url",
  audiomack: "audiomack_url",
  cifraPdf: "cifra_pdf_url",
  partituraPdf: "partitura_pdf_url",
};

// As flags vêm agregadas na mesma consulta (sem N+1).
const select = (extra = "") => `
  SELECT s.*,${extra}
         COALESCE(json_agg(json_build_object('id', f.id, 'group', f.group_name, 'slug', f.slug, 'name', f.name, 'color', f.color)
                  ORDER BY f.group_name, f.position, f.name) FILTER (WHERE f.id IS NOT NULL), '[]') AS flags
  FROM songs s
  LEFT JOIN song_flags sf ON sf.song_id = s.id
  LEFT JOIN flags f ON f.id = sf.flag_id`;
const SELECT = select();

const toSong = (r: SongRow): Song => ({
  id: r.id,
  number: r.number,
  slug: r.slug,
  title: r.title,
  composer: r.composer,
  key: r.song_key,
  lyrics: r.lyrics,
  media: { audio: r.audio_url, audiomack: r.audiomack_url, cifraPdf: r.cifra_pdf_url, partituraPdf: r.partitura_pdf_url },
  flags: r.flags,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

function songTaken(err: unknown): never {
  const constraint = (err as { constraint?: string }).constraint;
  throw new AppError(
    "SONG_TAKEN",
    constraint === "songs_number_key" ? "Já existe um canto com este número." : "Já existe um canto com este endereço (slug).",
  );
}

export class PgSongRepository implements SongRepository {
  constructor(private readonly pool: Pool) {}

  private async one(where: string, params: unknown[]) {
    const { rows } = await this.pool.query<SongRow>(`${SELECT} WHERE ${where} GROUP BY s.id`, params);
    return rows[0] ? toSong(rows[0]) : null;
  }

  findById(id: number) {
    return this.one("s.id = $1", [id]);
  }

  findBySlug(slug: string) {
    return this.one("s.slug = $1", [slug]);
  }

  async list(f: SongFilters) {
    const where: string[] = [];
    const params: unknown[] = [];
    const p = (v: unknown) => (params.push(v), `$${params.length}`);

    if (!f.includeInactive) where.push("s.active");
    if (f.q && /^\d+$/.test(f.q)) {
      // Só número ("45" ou "045"): o canto com esse número, sem varrer as letras (estrofes têm "1.", "2.").
      where.push(`(s.number = ${p(Number(f.q))} OR s.title ILIKE ${p(`%${f.q}%`)})`);
    } else if (f.q) {
      const like = p(`%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
      where.push(
        `(unaccent(s.title) ILIKE unaccent(${like}) OR unaccent(coalesce(s.composer, '')) ILIKE unaccent(${like})` +
          ` OR unaccent(s.lyrics) ILIKE unaccent(${like}))`,
      );
    }
    if (f.flagIds?.length) {
      // OU dentro do grupo, E entre grupos: um EXISTS por grupo das flags escolhidas.
      const { rows } = await this.pool.query<{ group_name: string; ids: number[] }>(
        "SELECT group_name, array_agg(id) AS ids FROM flags WHERE id = ANY($1::int[]) GROUP BY group_name",
        [f.flagIds],
      );
      if (rows.length < 1) where.push("false");
      for (const g of rows)
        where.push(`EXISTS (SELECT 1 FROM song_flags x WHERE x.song_id = s.id AND x.flag_id = ANY(${p(g.ids)}::int[]))`);
    }

    const { rows } = await this.pool.query<SongRow>(
      // count(*) OVER () = total de cantos do filtro, antes da paginação.
      `${select(" count(*) OVER () AS total,")} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       GROUP BY s.id
       ORDER BY s.number ASC NULLS LAST, s.title
       LIMIT ${p(f.pageSize)} OFFSET ${p((f.page - 1) * f.pageSize)}`,
      params,
    );
    return { songs: rows.map(toSong), total: Number(rows[0]?.total ?? 0) };
  }

  async create(d: SongData, userId: string) {
    return this.write(async (q) => {
      const { rows } = await q(
        `INSERT INTO songs (number, slug, title, composer, song_key, lyrics, audio_url, audiomack_url, cifra_pdf_url, partitura_pdf_url, active, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12) RETURNING id`,
        [d.number, d.slug, d.title, d.composer, d.key, d.lyrics, d.media.audio, d.media.audiomack, d.media.cifraPdf, d.media.partituraPdf, d.active, userId],
      );
      return rows[0].id as number;
    }, d.flagIds);
  }

  async update(id: number, d: SongData, userId: string) {
    const exists = await this.pool.query("SELECT 1 FROM songs WHERE id = $1", [id]);
    if (!exists.rowCount) return null;
    return this.write(async (q) => {
      await q(
        `UPDATE songs SET number = $2, slug = $3, title = $4, composer = $5, song_key = $6, lyrics = $7, audio_url = $8, audiomack_url = $9,
           cifra_pdf_url = $10, partitura_pdf_url = $11, active = $12, updated_by = $13, updated_at = now()
         WHERE id = $1`,
        [id, d.number, d.slug, d.title, d.composer, d.key, d.lyrics, d.media.audio, d.media.audiomack, d.media.cifraPdf, d.media.partituraPdf, d.active, userId],
      );
      return id;
    }, d.flagIds);
  }

  /** Grava o canto e substitui as flags numa transação só. */
  private async write(save: (q: (sql: string, params: unknown[]) => Promise<{ rows: { id?: number }[] }>) => Promise<number>, flagIds: number[]) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const id = await save((sql, params) => client.query(sql, params));
      await client.query("DELETE FROM song_flags WHERE song_id = $1", [id]);
      await client.query("INSERT INTO song_flags (song_id, flag_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING", [id, flagIds]);
      await client.query("COMMIT");
      return (await this.findById(id))!;
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23505") songTaken(err);
      throw err;
    } finally {
      client.release();
    }
  }

  async delete(id: number) {
    const { rowCount } = await this.pool.query("DELETE FROM songs WHERE id = $1", [id]);
    return Boolean(rowCount);
  }

  async setMedia(id: number, field: keyof SongMedia, url: string | null, userId: string) {
    const { rowCount } = await this.pool.query(
      `UPDATE songs SET ${MEDIA_COLUMN[field]} = $2, updated_by = $3, updated_at = now() WHERE id = $1`,
      [id, url, userId],
    );
    return rowCount ? this.findById(id) : null;
  }

  async existingIds(ids: number[]) {
    if (!ids.length) return [];
    const { rows } = await this.pool.query<{ id: number }>("SELECT id FROM songs WHERE id = ANY($1::int[])", [ids]);
    return rows.map((r) => r.id);
  }
}
