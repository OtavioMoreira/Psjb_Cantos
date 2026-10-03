import { z } from "zod";
import { FLAG_GROUPS, SONG_FILE_KINDS, type Flag, type Song } from "../domain/song.js";

// Só http(s): z.url() sozinho aceita "javascript:alert(1)", que vira XSS se cair num href.
const url = z.url({ protocol: /^https?$/, message: "Use um link http:// ou https://." }).max(500).nullable().default(null);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => v || null);

/** Corpo completo do canto (POST e PUT). */
export const songBodySchema = z.object({
  number: z.number().int().positive().max(99999).nullable().default(null),
  /** Opcional: sem ele, é gerado do número + título ("001-a-feliz-espera"). */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífens.")
    .max(160)
    .optional(),
  title: z.string().trim().min(1, "Informe o título.").max(200),
  composer: optionalText(200),
  key: z
    .string()
    .trim()
    // Tom = primeiro acorde da cifra, que às vezes tem extensão (C7, D9, F#m7).
    .regex(/^[A-G](#|b)?[^\s]{0,8}$/, "Tom inválido (ex.: D, Em, F#m, Bb, C7).")
    .nullable()
    .default(null),
  lyrics: z.string().max(50_000).default(""),
  media: z
    .object({ audio: url, audiomack: url, cifraPdf: url, partituraPdf: url })
    .default({ audio: null, audiomack: null, cifraPdf: null, partituraPdf: null }),
  flagIds: z.array(z.number().int().positive()).max(60).default([]),
  active: z.boolean().default(true),
});
export type SongBody = z.infer<typeof songBodySchema>;

/** PATCH: só os campos enviados mudam (media também pode vir parcial). */
export const songPatchSchema = z
  .object({
    number: songBodySchema.shape.number.unwrap(),
    slug: songBodySchema.shape.slug.unwrap(),
    title: songBodySchema.shape.title,
    composer: z.string().trim().max(200).nullable().transform((v) => v || null),
    key: songBodySchema.shape.key.unwrap(),
    lyrics: songBodySchema.shape.lyrics.unwrap(),
    media: z.object({ audio: url.unwrap(), audiomack: url.unwrap(), cifraPdf: url.unwrap(), partituraPdf: url.unwrap() }).partial(),
    flagIds: songBodySchema.shape.flagIds.unwrap(),
    active: songBodySchema.shape.active.unwrap(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envie pelo menos um campo.");
export type SongPatch = z.infer<typeof songPatchSchema>;

const idList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : []));

export const listSongsQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    /** ids de flags separados por vírgula (?flags=3,7): OU no mesmo grupo, E entre grupos. */
    flags: idList,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
    /** full=1 traz a letra junto (usado pelo build do site, que gera as páginas dos cantos). */
    full: z
      .enum(["1", "true", "0", "false"])
      .optional()
      .transform((v) => v === "1" || v === "true"),
  })
  .transform(({ flags, ...rest }) => ({ ...rest, flagIds: flags }));

export const songIdParamSchema = z.object({ id: z.coerce.number().int().positive("ID inválido.") });
export const songRefParamSchema = z.object({ ref: z.string().trim().min(1).max(160) });
export const songFileParamSchema = songIdParamSchema.extend({ kind: z.enum(SONG_FILE_KINDS) });

export const flagBodySchema = z.object({
  group: z.enum(FLAG_GROUPS),
  slug: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*$/, "Use letras, números e hífens (ex.: tempo-comum, A).")
    .max(60),
  name: z.string().trim().min(1, "Informe o nome.").max(80),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor no formato #RRGGBB.")
    .nullable()
    .default(null),
  position: z.number().int().min(0).max(999).default(0),
});
export const flagIdParamSchema = z.object({ id: z.coerce.number().int().positive("ID inválido.") });

export interface FlagDTO {
  id: number;
  group: Flag["group"];
  slug: string;
  name: string;
  color: string | null;
  position: number;
  songs: number;
}
export const toFlagDTO = (f: Flag): FlagDTO => ({ ...f });

export interface SongDTO {
  id: number;
  number: number | null;
  slug: string;
  title: string;
  composer: string | null;
  key: string | null;
  lyrics: string;
  media: Song["media"];
  flags: Song["flags"];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
/** Na listagem a letra fica de fora (fica pesada); vem só no detalhe. */
export type SongSummaryDTO = Omit<SongDTO, "lyrics">;

export function toSongDTO(s: Song): SongDTO {
  return { ...s, createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString() };
}
export function toSongSummaryDTO(s: Song): SongSummaryDTO {
  const { lyrics: _lyrics, ...rest } = toSongDTO(s);
  return rest;
}
