import { z } from "zod";
import { AUDIT_TARGETS } from "../domain/audit.js";

export const auditQuerySchema = z.object({
  targetType: z.enum(AUDIT_TARGETS).optional(),
  targetId: z.string().trim().max(64).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
