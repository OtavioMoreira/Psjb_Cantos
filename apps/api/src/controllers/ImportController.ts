import { timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { AppError } from "../domain/errors.js";
import {
  importIdParamSchema,
  importStatusQuerySchema,
  resolveImportBodySchema,
  runImportBodySchema,
  toImportItemDTO,
  toImportRunDTO,
} from "../dtos/import.dto.js";
import { validate } from "../http/validate.js";

/** Importação semanal dos salmos e aclamações (cron da Vercel) e a revisão no admin. */
export class ImportController {
  constructor(private readonly c: Container) {}

  /** GET chamado pelo Cron da Vercel, que manda "Authorization: Bearer <CRON_SECRET>". */
  cron = async (req: FastifyRequest) => {
    const secret = this.c.env.CRON_SECRET;
    if (!secret) throw new AppError("NOT_CONFIGURED", "A rotina automática não está configurada (CRON_SECRET).");
    const sent = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) throw new AppError("UNAUTHORIZED", "Credencial do cron inválida.");
    const { summary } = await this.c.actions.importPsalms.execute({ trigger: "cron" });
    return { ok: true, summary };
  };

  /** Botão "Buscar agora" do admin. */
  run = async (req: FastifyRequest) => this.c.actions.importPsalms.execute({ trigger: "manual", ...validate(runImportBodySchema, req.body ?? {}) });

  list = async (req: FastifyRequest) => {
    const { items, runs } = await this.c.actions.listImports.execute(validate(importStatusQuerySchema, req.query));
    return { items: items.map(toImportItemDTO), runs: runs.map(toImportRunDTO) };
  };

  resolve = async (req: FastifyRequest) => ({
    item: toImportItemDTO(
      await this.c.actions.resolveImport.execute(validate(importIdParamSchema, req.params).id, validate(resolveImportBodySchema, req.body)),
    ),
  });
}
