import type { SongFileKind } from "../domain/song.js";

// Regras puras da migração dos arquivos do site antigo (testadas em test/unit/legacyFiles.test.ts).

export const LEGACY_BASE_URL = "https://cantos.psjb.org.br/";

/** Colunas de `songs` com arquivos, e o tipo de arquivo de cada uma. */
export const FILE_COLUMNS = [
  { column: "cifra_pdf_url", kind: "cifra-pdf" },
  { column: "partitura_pdf_url", kind: "partitura-pdf" },
  { column: "audio_url", kind: "audio" },
] as const satisfies readonly { column: string; kind: SongFileKind }[];

export function isLegacyUrl(url: string | null | undefined, base = LEGACY_BASE_URL): url is string {
  return !!url && url.startsWith(base);
}

/**
 * Caminho do arquivo dentro do site antigo ("uploads/audios/253/200-X.pdf"), igual ao da pasta no cPanel.
 * Serve de nome no cache local e para achar o arquivo num backup. Recusa qualquer coisa que saia da pasta.
 */
export function legacyPath(url: string, base = LEGACY_BASE_URL): string {
  if (!isLegacyUrl(url, base)) throw new Error(`Não é do site antigo: ${url}`);
  // Sem o parser de URL: ele resolve "%2E%2E" sozinho e esconderia a tentativa de sair da pasta.
  const rel = decodeURIComponent(url.slice(base.length).split(/[?#]/)[0]);
  if (!rel || rel.split("/").some((part) => part === ".." || part === "")) throw new Error(`Caminho inválido: ${url}`);
  return rel;
}

/** Nome no storage novo: fixo por canto e tipo, para rodar de novo sobrescrevendo em vez de duplicar. */
export function storagePath(songId: number, kind: SongFileKind, ext: string): string {
  return `songs/${songId}/${kind}-legado.${ext}`;
}

export type FileColumn = (typeof FILE_COLUMNS)[number]["column"];
export type LegacyType = "pdf" | "mp3" | "m4a" | "ogg" | "wma" | "docx" | "jpg" | "png";

/**
 * Tipo real do arquivo, pelos bytes. O site antigo tem erros de cadastro: WMA no lugar do MP3,
 * cifra em Word, partitura em JPG, PDF no campo de áudio e MP3 no de cifra.
 */
export function detectType(b: Buffer): LegacyType | null {
  const head = (start: number, end: number) => b.subarray(start, end).toString("latin1");
  if (head(0, 5) === "%PDF-") return "pdf";
  if (head(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "mp3";
  if (head(4, 8) === "ftyp") return "m4a";
  if (head(0, 4) === "OggS") return "ogg";
  if (b.subarray(0, 4).equals(Buffer.from([0x30, 0x26, 0xb2, 0x75]))) return "wma";
  if (head(0, 4) === "PK\x03\x04" && b.includes("word/")) return "docx";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (head(1, 4) === "PNG") return "png";
  return null;
}

export const isAudioType = (t: LegacyType) => t === "mp3" || t === "m4a" || t === "ogg" || t === "wma";

const DOC_COLUMNS: FileColumn[] = ["cifra_pdf_url", "partitura_pdf_url"];

export interface PlacedFile {
  column: FileColumn;
  audio: boolean;
  /** Hash do conteúdo original: um PDF repetido em outro campo não vira arquivo novo. */
  hash: string;
}

/**
 * Para que campo vai cada arquivo de um canto (null = descartar). Quem está no campo certo fica;
 * áudio fora do lugar vai para o áudio e documento para a cifra ou, se ocupada, a partitura.
 * `occupied` são os campos com link que não entram nesta rodada.
 */
export function placeFiles(files: PlacedFile[], occupied: Iterable<FileColumn> = []): (FileColumn | null)[] {
  const fits = (f: PlacedFile) => (f.column === "audio_url") === f.audio;
  const taken = new Set<FileColumn>(occupied);
  for (const f of files) if (fits(f)) taken.add(f.column);
  return files.map((f) => {
    if (fits(f)) return f.column;
    if (!f.audio && files.some((o) => o !== f && fits(o) && o.hash === f.hash)) return null;
    const target = (f.audio ? (["audio_url"] as FileColumn[]) : DOC_COLUMNS).find((c) => !taken.has(c)) ?? null;
    if (target) taken.add(target);
    return target;
  });
}

/** Fica com o MP3 convertido só se ele de fato for menor (um áudio já leve não deve crescer). */
export function pickSmaller(original: Buffer, converted: Buffer | null): { data: Buffer; converted: boolean } {
  return converted && converted.length > 0 && converted.length < original.length
    ? { data: converted, converted: true }
    : { data: original, converted: false };
}

/** Executa `fn` em cada item com no máximo `limit` ao mesmo tempo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
