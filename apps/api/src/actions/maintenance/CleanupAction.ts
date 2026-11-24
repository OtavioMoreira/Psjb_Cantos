import type { Clock, MaintenanceRepository, PurgeResult } from "../../interfaces/index.js";

/** Folga depois do vencimento: dá para investigar um problema recente antes de o registro sumir. */
export const CLEANUP_GRACE_DAYS = 7;

/** Rotina diária (Cron da Vercel): apaga sessões, tokens de e-mail e aparelhos confiáveis vencidos há mais de 7 dias. */
export class CleanupAction {
  constructor(private readonly deps: { maintenance: MaintenanceRepository; clock: Clock }) {}

  execute(): Promise<PurgeResult> {
    return this.deps.maintenance.purgeExpired(this.deps.clock.now(), CLEANUP_GRACE_DAYS);
  }
}
