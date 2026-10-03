import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../config/env.js";
import { createPool } from "./pool.js";

// Importa o repertório de exemplo (data/songs.json) e a taxonomia (data/categories.json) para o banco.
// Mantém os ids dos cantos (as missas guardam songId). Pode rodar de novo: atualiza o que já existe.

const DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data");

interface Category {
  id: string;
  label: string;
  color?: string;
  order?: number;
}
interface SongJson {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  lyrics: string;
  moments: string[];
  seasons: string[];
  years: string[];
  themes: string[];
  media: { audio: string | null; audiomack: string | null; cifraPdf: string | null; partituraPdf: string | null };
}

const GROUPS = { moments: "momento", seasons: "tempo", years: "ano", themes: "tema" } as const;

async function main() {
  const categories = JSON.parse(await readFile(path.join(DATA, "categories.json"), "utf8")) as Record<keyof typeof GROUPS, Category[]>;
  const songs = JSON.parse(await readFile(path.join(DATA, "songs.json"), "utf8")) as SongJson[];
  const pool = createPool(loadEnv().DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Flags: uma por categoria, no grupo correspondente.
    const flagId = new Map<string, number>();
    for (const [key, group] of Object.entries(GROUPS) as [keyof typeof GROUPS, string][]) {
      for (const [i, c] of categories[key].entries()) {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO flags (group_name, slug, name, color, position) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (group_name, slug) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, position = EXCLUDED.position
           RETURNING id`,
          [group, c.id, c.label, c.color ?? null, c.order ?? i + 1],
        );
        flagId.set(`${group}:${c.id}`, rows[0].id);
      }
    }

    // 2. Cantos, com o mesmo id do JSON.
    for (const s of songs) {
      await client.query(
        `INSERT INTO songs (id, number, slug, title, composer, song_key, lyrics, audio_url, audiomack_url, cifra_pdf_url, partitura_pdf_url)
         OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET number = EXCLUDED.number, slug = EXCLUDED.slug, title = EXCLUDED.title, composer = EXCLUDED.composer,
           song_key = EXCLUDED.song_key, lyrics = EXCLUDED.lyrics, audio_url = EXCLUDED.audio_url, audiomack_url = EXCLUDED.audiomack_url,
           cifra_pdf_url = EXCLUDED.cifra_pdf_url, partitura_pdf_url = EXCLUDED.partitura_pdf_url, updated_at = now()`,
        [s.id, s.number, s.slug, s.title, s.composer, s.key, s.lyrics, s.media.audio, s.media.audiomack, s.media.cifraPdf, s.media.partituraPdf],
      );
      const ids = (Object.entries(GROUPS) as [keyof typeof GROUPS, string][]).flatMap(([key, group]) =>
        s[key].map((slug) => flagId.get(`${group}:${slug}`)).filter((x): x is number => x !== undefined),
      );
      await client.query("DELETE FROM song_flags WHERE song_id = $1", [s.id]);
      await client.query("INSERT INTO song_flags (song_id, flag_id) SELECT $1, unnest($2::int[])", [s.id, ids]);
    }

    // 3. O próximo id gerado pelo banco continua depois do maior importado.
    await client.query("SELECT setval(pg_get_serial_sequence('songs', 'id'), (SELECT max(id) FROM songs))");
    await client.query("COMMIT");
    console.log(`✔ ${flagId.size} flags e ${songs.length} cantos importados.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
