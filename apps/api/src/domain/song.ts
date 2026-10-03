// Cantos e flags (etiquetas). Regras em .claude/skills/psjb-regras-de-negocio §2 e §3.

export const FLAG_GROUPS = ["momento", "tempo", "ano", "tema", "outro"] as const;
export type FlagGroup = (typeof FLAG_GROUPS)[number];

export interface Flag {
  id: number;
  group: FlagGroup;
  slug: string;
  name: string;
  color: string | null;
  position: number;
  /** Quantos cantos têm esta flag. */
  songs: number;
}

export type FlagRef = Pick<Flag, "id" | "group" | "slug" | "name" | "color">;

export const SONG_FILE_KINDS = ["cifra-pdf", "partitura-pdf", "audio"] as const;
export type SongFileKind = (typeof SONG_FILE_KINDS)[number];

export interface SongMedia {
  audio: string | null;
  audiomack: string | null;
  cifraPdf: string | null;
  partituraPdf: string | null;
}

export interface Song {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  /** Letra com cifra; refrão entre **…**. */
  lyrics: string;
  media: SongMedia;
  flags: FlagRef[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Campo de mídia correspondente a cada tipo de arquivo enviado. */
export const FILE_MEDIA_FIELD: Record<SongFileKind, keyof SongMedia> = {
  "cifra-pdf": "cifraPdf",
  "partitura-pdf": "partituraPdf",
  audio: "audio",
};

/** "A Feliz Espera" + 1 → "001-a-feliz-espera" (mesma regra do site: número com 3 dígitos). */
export function songSlug(title: string, number: number | null): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return number ? `${String(number).padStart(3, "0")}-${base}` : base || "canto";
}
