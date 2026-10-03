import { z } from "zod";
import { AppError } from "../domain/errors.js";

/** Valida a entrada com o schema do DTO. Erro vira 400 com a mensagem de cada campo. */
export function validate<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields });
}
