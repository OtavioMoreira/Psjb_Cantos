import { createHash } from "node:crypto";
import { execFile, spawnSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { loadEnv } from "../config/env.js";
import { createAdapters } from "../container.js";
import type { SongFileKind } from "../domain/song.js";
import {
  detectType,
  FILE_COLUMNS,
  type FileColumn,
  isAudioType,
  isLegacyUrl,
  LEGACY_BASE_URL,
  legacyPath,
  type LegacyType,
  mapLimit,
  pickSmaller,
  placeFiles,
  storagePath,
} from "./legacyFiles.js";

// Copia os PDFs e MP3 do site antigo (cantos.psjb.org.br/uploads/...) para o storage da API
// (Vercel Blob com BLOB_READ_WRITE_TOKEN; senão, apps/api/uploads/) e troca os links em `songs`.
//
// Etapas, todas retomáveis:
//   1. baixa os originais para db/arquivos-legado/originais/ (é também o backup dos arquivos da HostGator);
//   2. prepara cada arquivo em db/arquivos-legado/<perfil>/:
//      - áudio (MP3, e também os WMA cadastrados por engano) → MP3 64 kbps mono, para caber no plano grátis do Blob;
//      - cifra em Word e partitura em imagem → PDF (LibreOffice);
//   3. corrige o campo de quem foi cadastrado no lugar errado (PDF no áudio, MP3 na cifra; PDF repetido é descartado),
//      envia para o storage e troca os links, só se ninguém os mudou nesse meio-tempo.
// Rodar de novo só processa os links que continuam apontando para o site antigo.
//
// Opções:
//   --origem <pasta>   lê de um backup (a pasta que contém uploads/) em vez de baixar do site antigo
//   --so-baixar        só faz a etapa 1 (backup), sem converter nem mexer no banco
//   --refazer          processa de novo também os arquivos já migrados (ex.: depois de mudar a qualidade do áudio);
//                      a origem de cada um vem do data/songs.json
//   --limite <n>       só os n primeiros cantos (para testar)

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const CACHE = path.join(ROOT, "db/arquivos-legado");
/** Voz e violão continuam limpos em 64 kbps mono; 17 h de áudio ficam em ~500 MB. */
const AUDIO_PROFILE = { dir: "64k-mono", args: ["-ac", "1", "-ar", "44100", "-b:a", "64k"] };
const FFMPEG_IMAGE = "jrottenberg/ffmpeg:7.1-alpine";
const FFMPEG_ARGS = ["-nostdin", "-loglevel", "error", "-y", "-map", "0:a", "-codec:a", "libmp3lame", ...AUDIO_PROFILE.args, "-id3v2_version", "3"];
const KIND = Object.fromEntries(FILE_COLUMNS.map((c) => [c.column, c.kind])) as Record<FileColumn, SongFileKind>;
const JSON_FIELD: Record<FileColumn, string> = { cifra_pdf_url: "cifraPdf", partitura_pdf_url: "partituraPdf", audio_url: "audio" };
/** Arquivo que este script já enviou: songs/<id>/<tipo>-legado.<ext>. */
const MIGRATED = /\/songs\/\d+\/[a-z-]+-legado\.\w+$/;

interface Job {
  songId: number;
  title: string;
  column: FileColumn;
  /** Link no site antigo (de onde vem o arquivo). */
  url: string;
  /** Valor atual no banco: a troca só acontece se ele não mudou. */
  current: string;
  rel: string;
}
interface Prepared {
  data: Buffer;
  ext: string;
  contentType: string;
  audio: boolean;
  hash: string;
  before: number;
  note?: string;
}
interface Failure {
  songId: number;
  title: string;
  column: FileColumn;
  url: string;
  motivo: string;
}

const { values: opts } = parseArgs({
  options: {
    origem: { type: "string" },
    "so-baixar": { type: "boolean", default: false },
    refazer: { type: "boolean", default: false },
    limite: { type: "string" },
  },
});

const exists = (p: string) => stat(p).then(() => true, () => false);
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Alguns cantos dividem o mesmo arquivo: cada caminho é baixado (e convertido) uma vez só. */
function once<T>(cache: Map<string, Promise<T>>, key: string, fn: () => Promise<T>) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key)!;
}
const downloads = new Map<string, Promise<string>>();
const conversions = new Map<string, Promise<void>>();

/** Etapa 1: o original no cache, vindo do backup (--origem) ou do site antigo. */
const fetchOriginal = (job: Job) => once(downloads, job.rel, () => downloadOriginal(job));
async function downloadOriginal(job: Job): Promise<string> {
  const target = path.join(CACHE, "originais", job.rel);
  if (await exists(target)) return target;
  await mkdir(path.dirname(target), { recursive: true });
  if (opts.origem) {
    await copyFile(path.join(path.resolve(opts.origem), job.rel), target);
    return target;
  }
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(job.url, { signal: AbortSignal.timeout(120_000) });
      if (res.status === 404) throw new Error("não existe no site antigo (404)");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Grava num temporário: um arquivo pela metade (falha ou Ctrl+C) não pode valer como pronto.
      await writeFile(`${target}.parcial`, Buffer.from(await res.arrayBuffer()));
      await rename(`${target}.parcial`, target);
      return target;
    } catch (err) {
      lastError = (err as Error).message;
      if (lastError.includes("404")) break;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(lastError);
}

/** ffmpeg instalado ou, se não houver, um container que fica de pé enquanto o script roda. */
async function createAudioConverter() {
  if (spawnSync("ffmpeg", ["-version"]).status === 0)
    return {
      convert: (input: string, output: string) => run("ffmpeg", ["-i", input, ...FFMPEG_ARGS, output]).then(() => undefined),
      stop: async () => undefined,
    };
  const name = `psjb-ffmpeg-${process.pid}`;
  const user = `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
  console.log(`  ffmpeg não instalado: usando o Docker (${FFMPEG_IMAGE}).`);
  await run("docker", ["run", "-d", "--rm", "--name", name, "--user", user, "-v", `${CACHE}:/w`, "--entrypoint", "sleep", FFMPEG_IMAGE, "infinity"]);
  const inContainer = (p: string) => `/w/${path.relative(CACHE, p)}`;
  return {
    convert: (input: string, output: string) =>
      run("docker", ["exec", name, "ffmpeg", "-i", inContainer(input), ...FFMPEG_ARGS, inContainer(output)]).then(() => undefined),
    stop: () => run("docker", ["rm", "-f", name]).then(() => undefined, () => undefined),
  };
}

/** Word e imagem → PDF pelo LibreOffice. Um de cada vez: instâncias simultâneas brigam pelo mesmo perfil. */
let officeQueue: Promise<unknown> = Promise.resolve();
function toPdf(input: string, output: string): Promise<void> {
  const task = officeQueue.then(async () => {
    if (spawnSync("soffice", ["--version"]).status !== 0)
      throw new Error("precisa do LibreOffice (soffice) para converter em PDF");
    const outDir = path.join(path.dirname(output), ".soffice");
    await run("soffice", ["--headless", "--convert-to", "pdf", "--outdir", outDir, input], { timeout: 120_000 });
    await rename(path.join(outDir, path.basename(input).replace(/\.[^.]+$/, ".pdf")), output);
    await rm(outDir, { recursive: true, force: true });
  });
  officeQueue = task.catch(() => undefined);
  return task;
}

const NOTES: Partial<Record<LegacyType, string>> = {
  wma: "WMA convertido para MP3",
  docx: "Word convertido para PDF",
  jpg: "imagem convertida para PDF",
  png: "imagem convertida para PDF",
};

type AudioConverter = Awaited<ReturnType<typeof createAudioConverter>>;

/** Etapa 2: o arquivo final (MP3 ou PDF), a partir do tipo real e não do campo onde estava. */
async function prepare(job: Job, original: string, audioConverter: AudioConverter): Promise<Prepared> {
  const data = await readFile(original);
  const type = detectType(data);
  if (!type) throw new Error("tipo de arquivo desconhecido");
  const audio = isAudioType(type);
  const base = { audio, hash: createHash("sha256").update(data).digest("hex"), before: data.length, note: NOTES[type] };
  if (type === "pdf") return { ...base, data, ext: "pdf", contentType: "application/pdf" };

  const output = path.join(CACHE, audio ? AUDIO_PROFILE.dir : "pdf", job.rel.replace(/\.[^./]+$/, "") + (audio ? ".mp3" : ".pdf"));
  await once(conversions, output, async () => {
    if (await exists(output)) return;
    await mkdir(path.dirname(output), { recursive: true });
    const partial = output.replace(/(\.\w+)$/, ".parcial$1");
    await (audio ? audioConverter.convert(original, partial) : toPdf(original, partial));
    await rename(partial, output);
  });
  const converted = await readFile(output);
  if (!audio) return { ...base, data: converted, ext: "pdf", contentType: "application/pdf" };
  // Um MP3 que já era leve não deve crescer; os demais formatos sempre viram MP3.
  const data2 = type === "mp3" ? pickSmaller(data, converted).data : converted;
  return { ...base, data: data2, ext: "mp3", contentType: "audio/mpeg" };
}

async function main() {
  const env = loadEnv();
  const { pool, storage } = createAdapters(env);
  const failures: Failure[] = [];
  const fail = (job: Job, err: unknown) =>
    failures.push({ songId: job.songId, title: job.title, column: job.column, url: job.url, motivo: (err as Error).message });

  try {
    // Origem de cada arquivo já migrado (para --refazer): o link antigo continua no data/songs.json.
    const fromJson = new Map<number, Record<string, string | null>>();
    if (opts.refazer) {
      const songs = JSON.parse(await readFile(path.join(ROOT, "data/songs.json"), "utf8")) as {
        id: number;
        media: Record<string, string | null>;
      }[];
      for (const s of songs) fromJson.set(s.id, s.media);
    }
    const cols = FILE_COLUMNS.map((c) => c.column);
    const where = cols.map((c) => (opts.refazer ? `${c} LIKE $1 OR ${c} LIKE '%-legado.%'` : `${c} LIKE $1`)).join(" OR ");
    const limit = opts.limite ? `LIMIT ${Number.parseInt(opts.limite, 10)}` : "";
    const { rows } = await pool.query<Record<FileColumn, string | null> & { id: number; title: string }>(
      `SELECT id, title, ${cols.join(", ")} FROM songs WHERE ${where} ORDER BY id ${limit}`,
      [`${LEGACY_BASE_URL}%`],
    );

    const jobs: Job[] = [];
    for (const row of rows)
      for (const column of cols) {
        const current = row[column];
        if (!current) continue;
        const url = isLegacyUrl(current) ? current : MIGRATED.test(current) ? fromJson.get(row.id)?.[JSON_FIELD[column]] : null;
        if (!isLegacyUrl(url)) continue;
        try {
          jobs.push({ songId: row.id, title: row.title, column, url, current, rel: legacyPath(url) });
        } catch (err) {
          failures.push({ songId: row.id, title: row.title, column, url, motivo: (err as Error).message });
        }
      }
    const target = opts["so-baixar"] ? "só backup" : env.BLOB_READ_WRITE_TOKEN ? "Vercel Blob" : "pasta local apps/api/uploads/";
    console.log(`${rows.length} cantos com ${jobs.length} arquivos do site antigo. Destino: ${target}.`);

    // 1. Originais (com poucas conexões ao mesmo tempo, para não sobrecarregar o site antigo).
    const originals = new Map<Job, string>();
    let done = 0;
    await mapLimit(jobs, 6, async (job) => {
      try {
        originals.set(job, await fetchOriginal(job));
      } catch (err) {
        fail(job, err);
      }
      if (++done % 100 === 0 || done === jobs.length) console.log(`  baixados ${done}/${jobs.length}`);
    });
    if (opts["so-baixar"]) {
      console.log(`✔ Backup em ${path.relative(ROOT, CACHE)}/originais (${originals.size} arquivos).`);
      return;
    }

    // 2. Conversões.
    const prepared = new Map<Job, Prepared>();
    const audioConverter = await createAudioConverter();
    try {
      done = 0;
      await mapLimit([...originals.keys()], 4, async (job) => {
        try {
          prepared.set(job, await prepare(job, originals.get(job)!, audioConverter));
        } catch (err) {
          fail(job, err);
        }
        if (++done % 100 === 0 || done === originals.size) console.log(`  preparados ${done}/${originals.size}`);
      });
    } finally {
      await audioConverter.stop();
    }

    // 3. Por canto: campo certo de cada arquivo, envio e troca dos links numa única atualização.
    const bySong = new Map<number, Job[]>();
    for (const job of prepared.keys()) bySong.set(job.songId, [...(bySong.get(job.songId) ?? []), job]);
    const rowById = new Map(rows.map((r) => [r.id, r]));
    let before = 0;
    let after = 0;
    let replaced = 0;
    const fixes: string[] = [];
    done = 0;
    await mapLimit([...bySong.entries()], 4, async ([songId, songJobs]) => {
      try {
        const row = rowById.get(songId)!;
        // Campos com link que não entram nesta rodada (ex.: download que falhou) contam como ocupados.
        const occupied = cols.filter((c) => row[c] && !songJobs.some((j) => j.column === c));
        const targets = placeFiles(
          songJobs.map((j) => ({ column: j.column, audio: prepared.get(j)!.audio, hash: prepared.get(j)!.hash })),
          occupied,
        );
        // Campo que perdeu o arquivo (movido ou descartado) fica vazio.
        const set = new Map<FileColumn, string | null>(songJobs.map((j) => [j.column, null]));
        for (const [i, job] of songJobs.entries()) {
          const file = prepared.get(job)!;
          const column = targets[i];
          if (file.note) fixes.push(`canto ${songId} (${job.title}): ${file.note}`);
          if (column !== job.column)
            fixes.push(`canto ${songId} (${job.title}): ${KIND[job.column]} → ${column ? KIND[column] : "descartado (cópia de outro arquivo)"}`);
          if (!column) continue;
          set.set(column, await storage.put(storagePath(songId, KIND[column], file.ext), file.data, file.contentType));
          before += file.before;
          after += file.data.length;
        }
        const entries = [...set.entries()];
        const { rowCount } = await pool.query(
          `UPDATE songs SET ${entries.map(([c], i) => `${c} = $${i + 2}`).join(", ")}, updated_at = now()
           WHERE id = $1 AND ${songJobs.map((j, i) => `${j.column} = $${entries.length + i + 2}`).join(" AND ")}`,
          [songId, ...entries.map(([, v]) => v), ...songJobs.map((j) => j.current)],
        );
        if (rowCount) replaced += songJobs.length;
        else for (const job of songJobs) fail(job, new Error("o link mudou durante a migração; rode de novo"));
      } catch (err) {
        for (const job of songJobs) fail(job, err);
      }
      if (++done % 100 === 0 || done === bySong.size) console.log(`  cantos atualizados ${done}/${bySong.size}`);
    });

    if (fixes.length) {
      console.log(`Correções de cadastro do site antigo (${fixes.length}):`);
      for (const f of fixes) console.log(`  - ${f}`);
    }
    console.log(`✔ ${replaced} arquivos migrados. Tamanho: ${mb(before)} no site antigo → ${mb(after)} no storage.`);
  } finally {
    await pool.end();
    await rm(path.join(CACHE, "falhas.json"), { force: true });
    if (failures.length) {
      await mkdir(CACHE, { recursive: true });
      const report = path.join(CACHE, "falhas.json");
      await writeFile(report, JSON.stringify(failures, null, 2));
      console.log(`⚠ ${failures.length} arquivos com problema (continuam com o link antigo). Lista em ${path.relative(ROOT, report)}:`);
      for (const f of failures.slice(0, 15)) console.log(`  - canto ${f.songId} (${f.title}), ${KIND[f.column]}: ${f.motivo}`);
      if (failures.length > 15) console.log(`  … e mais ${failures.length - 15}.`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
