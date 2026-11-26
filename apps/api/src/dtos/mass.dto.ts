import { z } from "zod";
import { massAccess, MOMENTS, SEASONS, TRANSPOSE_MAX, TRANSPOSE_MIN, YEARS, type Mass, type MassAccess } from "../domain/mass.js";

const itemSchema = z.object({
  songId: z.number().int().positive(),
  transpose: z.number().int().min(TRANSPOSE_MIN).max(TRANSPOSE_MAX).default(0),
});

const slotSchema = z.object({
  id: z.string().trim().min(1).max(40),
  moment: z.enum([...MOMENTS, "extra"]),
  label: z.string().trim().min(1, "Informe o nome do momento.").max(80),
  items: z.array(itemSchema).max(10).default([]),
});

/** Roteiro da celebração (PDF de 1 página da equipe de liturgia). */
const scriptItemSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().max(120).default(""),
  kind: z.enum(["texto", "cantos"]),
  slotIds: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  text: z.string().max(4000).default(""),
  boxed: z.boolean().default(false),
});
export const scriptSchema = z.object({
  title: z.string().trim().max(200).default(""),
  notes: z.string().max(1000).default(""),
  items: z.array(scriptItemSchema).max(60).default([]),
});

/** Corpo completo da missa (POST e PUT). Campos ausentes assumem o padrão. */
export const massBodySchema = z.object({
  name: z.string().trim().max(120).default(""),
  date: z.iso.date("Data inválida (use aaaa-mm-dd).").nullable().default(null),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido (use HH:mm).")
    .nullable()
    .default(null),
  season: z.enum(SEASONS).nullable().default(null),
  year: z.enum(YEARS).nullable().default(null),
  /** Só admin, e só o dono, liga ou desliga. Exige data. */
  suggested: z.boolean().default(false),
  script: scriptSchema.nullable().default(null),
  slots: z
    .array(slotSchema)
    .max(40)
    .default([])
    .refine((slots) => new Set(slots.map((s) => s.id)).size === slots.length, "Há momentos com o mesmo id."),
});
export type MassBody = z.infer<typeof massBodySchema>;

/** Criar aceita um id (UUID) gerado pelo front, para o editor funcionar antes de falar com a API. */
export const createMassSchema = massBodySchema.extend({ id: z.uuid("ID inválido.").optional() });

export const joinBodySchema = z.object({ token: z.string().trim().min(16, "Link inválido.").max(64) });

/** PATCH: só os campos enviados mudam. */
export const massPatchSchema = z
  .object({
    name: massBodySchema.shape.name.unwrap(),
    date: massBodySchema.shape.date.unwrap(),
    time: massBodySchema.shape.time.unwrap(),
    season: massBodySchema.shape.season.unwrap(),
    year: massBodySchema.shape.year.unwrap(),
    suggested: massBodySchema.shape.suggested.unwrap(),
    script: massBodySchema.shape.script.unwrap(),
    slots: massBodySchema.shape.slots.unwrap(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Envie pelo menos um campo.");
export type MassPatch = z.infer<typeof massPatchSchema>;

/** If-Match com a versão da missa: `3` ou `"3"` (ETag). Ausente = grava sem conferir. */
export const ifMatchSchema = z
  .string()
  .trim()
  .regex(/^(W\/)?"?\d{1,9}"?$/, "If-Match inválido (use a versão da missa).")
  .transform((v) => Number(v.replace(/\D/g, "")))
  .optional();

export const massIdParamSchema = z.object({ id: z.uuid("ID inválido.") });

export const listMassesQuerySchema = z.object({
  when: z.enum(["upcoming", "past", "all"]).default("all"),
  q: z.string().trim().max(100).optional(),
});

export const shareBodySchema = z.object({
  userIds: z.array(z.uuid("ID de usuário inválido.")).max(100),
});

export interface PersonDTO {
  id: string;
  name: string;
  photoUrl: string | null;
}

export interface MassDTO {
  id: string;
  name: string;
  date: string | null;
  time: string | null;
  season: Mass["season"];
  year: Mass["year"];
  slots: Mass["slots"];
  suggested: boolean;
  script: Mass["script"];
  owner: PersonDTO;
  sharedWith: PersonDTO[];
  /** Como a pessoa que pediu enxerga a missa: dona, convidada ou só a sugestão da semana (leitura). */
  access: MassAccess | "suggestion";
  /** Só para o dono: token do link de convite (null = sem link). Convidados recebem sempre null. */
  shareToken: string | null;
  /** Mandar de volta no If-Match do PUT/PATCH: se outra pessoa salvou antes, a API responde 409. */
  version: number;
  updatedBy: PersonDTO | null;
  createdAt: string;
  updatedAt: string;
}

export function toMassDTO(m: Mass, viewerId: string): MassDTO {
  return {
    id: m.id,
    name: m.name,
    date: m.date,
    time: m.time,
    season: m.season,
    year: m.year,
    slots: m.slots,
    suggested: m.suggested,
    script: m.script,
    owner: m.owner,
    // Quem só vê a sugestão não precisa saber com quem o admin compartilhou.
    sharedWith: massAccess(m, viewerId) ? m.sharedWith : [],
    access: massAccess(m, viewerId) ?? (m.suggested ? "suggestion" : "shared"),
    shareToken: massAccess(m, viewerId) === "owner" ? m.shareToken : null,
    version: m.version,
    updatedBy: m.updatedBy,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
