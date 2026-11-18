import type { Pool } from "../database/pool.js";
import type { ImportItem, ImportItemData, ImportRepository, ImportRun, ImportStatus } from "../interfaces/index.js";

interface ItemRow {
  id: number;
  source: string;
  external_id: string;
  title: string;
  kind: ImportItem["kind"];
  celebration_date: string;
  pdf_url: string | null;
  audio_url: string | null;
  pdf_hash: string | null;
  status: ImportStatus;
  song_id: number | null;
  candidate_song_ids: number[];
  message: string | null;
  created_at: Date;
  updated_at: Date;
}

// A data vem como texto (AAAA-MM-DD), sem conversão de fuso.
const ITEM = `id, source, external_id, title, kind, to_char(celebration_date, 'YYYY-MM-DD') AS celebration_date, pdf_url, audio_url,
  pdf_hash, status, song_id, candidate_song_ids, message, created_at, updated_at`;

const toItem = (r: ItemRow): ImportItem => ({
  id: r.id,
  source: r.source,
  externalId: r.external_id,
  title: r.title,
  kind: r.kind,
  celebrationDate: r.celebration_date,
  pdfUrl: r.pdf_url,
  audioUrl: r.audio_url,
  pdfHash: r.pdf_hash,
  status: r.status,
  songId: r.song_id,
  candidateSongIds: r.candidate_song_ids,
  message: r.message,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class PgImportRepository implements ImportRepository {
  constructor(private readonly pool: Pool) {}

  async findItem(source: string, externalId: string) {
    const { rows } = await this.pool.query<ItemRow>(`SELECT ${ITEM} FROM import_items WHERE source = $1 AND external_id = $2`, [source, externalId]);
    return rows[0] ? toItem(rows[0]) : null;
  }

  async getItem(id: number) {
    const { rows } = await this.pool.query<ItemRow>(`SELECT ${ITEM} FROM import_items WHERE id = $1`, [id]);
    return rows[0] ? toItem(rows[0]) : null;
  }

  async songIdByPdfHash(source: string, hash: string) {
    const { rows } = await this.pool.query<{ song_id: number }>(
      `SELECT song_id FROM import_items
       WHERE source = $1 AND pdf_hash = $2 AND song_id IS NOT NULL AND status = 'created'
       ORDER BY id LIMIT 1`,
      [source, hash],
    );
    return rows[0]?.song_id ?? null;
  }

  async saveItem(d: ImportItemData) {
    const { rows } = await this.pool.query<ItemRow>(
      `INSERT INTO import_items (source, external_id, title, kind, celebration_date, pdf_url, audio_url, pdf_hash, status, song_id, candidate_song_ids, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (source, external_id) DO UPDATE SET title = EXCLUDED.title, pdf_url = EXCLUDED.pdf_url, audio_url = EXCLUDED.audio_url,
         pdf_hash = EXCLUDED.pdf_hash, status = EXCLUDED.status, song_id = EXCLUDED.song_id, candidate_song_ids = EXCLUDED.candidate_song_ids,
         message = EXCLUDED.message, updated_at = now()
       RETURNING ${ITEM}`,
      [d.source, d.externalId, d.title, d.kind, d.celebrationDate, d.pdfUrl, d.audioUrl, d.pdfHash, d.status, d.songId, d.candidateSongIds, d.message],
    );
    return toItem(rows[0]);
  }

  async listItems({ status, limit }: { status?: ImportStatus; limit: number }) {
    const { rows } = await this.pool.query<ItemRow>(
      `SELECT ${ITEM} FROM import_items ${status ? "WHERE status = $2" : ""} ORDER BY celebration_date DESC, id DESC LIMIT $1`,
      status ? [limit, status] : [limit],
    );
    return rows.map(toItem);
  }

  async startRun(source: string, trigger: ImportRun["trigger"]) {
    const { rows } = await this.pool.query<{ id: number }>("INSERT INTO import_runs (source, trigger) VALUES ($1, $2) RETURNING id", [source, trigger]);
    return rows[0].id;
  }

  async finishRun(id: number, summary: Record<string, number>, error: string | null) {
    await this.pool.query("UPDATE import_runs SET finished_at = now(), summary = $2, error = $3 WHERE id = $1", [id, summary, error]);
  }

  async listRuns(limit: number) {
    const { rows } = await this.pool.query<{
      id: number;
      source: string;
      trigger: ImportRun["trigger"];
      started_at: Date;
      finished_at: Date | null;
      summary: Record<string, number>;
      error: string | null;
    }>("SELECT * FROM import_runs ORDER BY started_at DESC, id DESC LIMIT $1", [limit]);
    return rows.map((r) => ({ id: r.id, source: r.source, trigger: r.trigger, startedAt: r.started_at, finishedAt: r.finished_at, summary: r.summary, error: r.error }));
  }
}
