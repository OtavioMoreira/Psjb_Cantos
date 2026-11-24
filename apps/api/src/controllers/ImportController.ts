import type { FastifyRequest } from "fastify";
import type { Container } from "../container.js";
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

  /** GET chamado pelo Cron da Vercel (a rota passa pelo cronGuard). */
  cron = async () => {
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
