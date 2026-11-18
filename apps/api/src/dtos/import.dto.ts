import { z } from "zod";
import type { ImportItem, ImportRun } from "../interfaces/index.js";

export const importStatusQuerySchema = z.object({
  status: z.enum(["created", "linked", "review", "ignored", "failed"]).optional(),
});
export const runImportBodySchema = z
  .object({ days: z.number().int().min(1).max(60).default(10) })
  .default({ days: 10 });
export const importIdParamSchema = z.object({ id: z.coerce.number().int().positive("ID inválido.") });
export const resolveImportBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("link"), songId: z.number().int().positive() }),
  z.object({ action: z.literal("create") }),
  z.object({ action: z.literal("ignore") }),
]);

export const toImportItemDTO = (i: ImportItem) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() });
export const toImportRunDTO = (r: ImportRun) => ({ ...r, startedAt: r.startedAt.toISOString(), finishedAt: r.finishedAt?.toISOString() ?? null });
