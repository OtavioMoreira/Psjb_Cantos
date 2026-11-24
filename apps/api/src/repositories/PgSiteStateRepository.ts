import type { Pool } from "../database/pool.js";
import type { SiteState, SiteStateRepository } from "../interfaces/index.js";

interface Row {
  content_changed_at: Date;
  published_at: Date | null;
  published_by_name: string | null;
}

const toState = (r: Row): SiteState => ({ contentChangedAt: r.content_changed_at, publishedAt: r.published_at, publishedByName: r.published_by_name });

/** Linha única de `site_state`. A mudança de conteúdo é marcada pelos gatilhos de songs, flags e song_flags. */
export class PgSiteStateRepository implements SiteStateRepository {
  constructor(private readonly pool: Pool) {}

  async get() {
    const { rows } = await this.pool.query<Row>("SELECT content_changed_at, published_at, published_by_name FROM site_state");
    // Sem a linha (não deveria acontecer), trata como "nunca publicado".
    return rows[0] ? toState(rows[0]) : { contentChangedAt: new Date(0), publishedAt: null, publishedByName: null };
  }

  async markPublished(byName: string) {
    const { rows } = await this.pool.query<Row>(
      `INSERT INTO site_state (id, content_changed_at, published_at, published_by_name) VALUES (true, now(), clock_timestamp(), $1)
       ON CONFLICT (id) DO UPDATE SET published_at = EXCLUDED.published_at, published_by_name = EXCLUDED.published_by_name
       RETURNING content_changed_at, published_at, published_by_name`,
      [byName.slice(0, 120)],
    );
    return toState(rows[0]);
  }
}
