// Texto das entradas da auditoria (Admin › Auditoria). A API grava códigos estáveis ("user.block");
// aqui eles viram frases: "Padre João bloqueou Maria Souza".

export type AuditTarget = "user" | "movement" | "song" | "flag" | "site" | "import";

export interface AuditEntry {
  id: number;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: AuditTarget;
  targetId: string | null;
  targetLabel: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

const FILE_KIND: Record<string, string> = { "cifra-pdf": "o PDF da cifra", "partitura-pdf": "a partitura", audio: "o áudio" };

const FIELD: Record<string, string> = {
  name: "nome",
  email: "e-mail",
  phone: "telefone",
  movementId: "movimento",
  movementIds: "movimentos",
  roles: "papel",
  number: "número",
  title: "título",
  composer: "autor",
  key: "tom",
  lyrics: "letra",
  media: "mídias",
  flagIds: "flags",
  active: "visibilidade",
};

const DECISION: Record<string, string> = { link: "ligou a um canto do repertório", create: "criou um canto novo", ignore: "ignorou" };

const ROLE: Record<string, string> = { admin: "Administrador", musico: "Músico" };

/** Verbo da ação; `{t}` é o nome do alvo. */
const VERB: Record<string, string> = {
  "user.invite": "convidou {t}",
  "user.invite-bulk": "convidou várias pessoas de uma vez",
  "user.resend-invite": "reenviou o convite para {t}",
  "user.reset-link": "enviou o link de redefinição de senha para {t}",
  "user.activate": "ativou a conta de {t}",
  "user.update": "editou os dados de {t}",
  "user.block": "bloqueou {t}",
  "user.unblock": "liberou {t}",
  "user.temporary-password": "gerou uma senha temporária para {t}",
  "user.delete": "excluiu a conta de {t}",
  "movement.create": "criou o movimento {t}",
  "movement.rename": "renomeou o movimento para {t}",
  "movement.delete": "excluiu o movimento {t}",
  "song.create": "criou o canto {t}",
  "song.update": "editou o canto {t}",
  "song.delete": "excluiu o canto {t}",
  "song.upload-file": "enviou {kind} de {t}",
  "song.remove-file": "removeu {kind} de {t}",
  "flag.create": "criou a flag {t}",
  "flag.update": "editou a flag {t}",
  "flag.delete": "excluiu a flag {t}",
  "site.publish": "publicou o site",
  "import.run": "buscou os salmos da diocese",
  "import.resolve": "resolveu o salmo importado {t}",
};

/** "bloqueou Maria Souza" (sem o nome de quem fez). */
export function auditSentence(e: AuditEntry): string {
  const target = e.targetLabel ? `“${e.targetLabel}”` : e.targetId ? `#${e.targetId}` : "";
  const verb = VERB[e.action] ?? e.action;
  const kind = FILE_KIND[String(e.details.kind)] ?? "um arquivo";
  return verb.replace("{kind}", kind).replace("{t}", target).replace(/\s+/g, " ").trim();
}

/** Linha de detalhe: motivo, campos alterados, papel, decisão. null se não há nada a mostrar. */
export function auditDetails(e: AuditEntry): string | null {
  const d = e.details;
  const parts: string[] = [];
  if (typeof d.reason === "string" && d.reason) parts.push(`Motivo: ${d.reason}`);
  if (Array.isArray(d.fields) && d.fields.length) parts.push(`Alterou: ${d.fields.map((f) => FIELD[String(f)] ?? String(f)).join(", ")}`);
  if (Array.isArray(d.roles) && d.roles.length) parts.push(`Papel: ${d.roles.includes("admin") ? ROLE.admin : ROLE.musico}`);
  if (typeof d.decision === "string") parts.push(`Decisão: ${DECISION[d.decision] ?? d.decision}`);
  if (typeof d.email === "string") parts.push(String(d.email));
  if (typeof d.count === "number") parts.push(`${d.count} pessoa${d.count === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : null;
}
