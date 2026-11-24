// Registro de auditoria: quem fez o quê na área de administração. Regras em
// .claude/skills/psjb-regras-de-negocio §12.

export const AUDIT_TARGETS = ["user", "movement", "song", "flag", "site", "import"] as const;
export type AuditTarget = (typeof AUDIT_TARGETS)[number];

export interface AuditEntry {
  id: number;
  /** null se a conta de quem fez foi excluída (o nome fica guardado). */
  actorId: string | null;
  actorName: string;
  /** Código estável, ex.: "user.block". O front traduz para o texto da tela. */
  action: string;
  targetType: AuditTarget;
  targetId: string | null;
  /** Nome do alvo na hora da ação (continua legível se ele for excluído). */
  targetLabel: string | null;
  /** Só o que ajuda a entender a ação (motivo do bloqueio, campos alterados). Nunca senha ou letra. */
  details: Record<string, unknown>;
  createdAt: Date;
}

export type AuditEntryData = Omit<AuditEntry, "id" | "createdAt">;
