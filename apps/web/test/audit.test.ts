import { describe, expect, it } from "vitest";
import { auditDetails, auditSentence, type AuditEntry } from "@/lib/audit";

const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 1,
  actorId: "u1",
  actorName: "Padre João",
  action: "user.block",
  targetType: "user",
  targetId: "u2",
  targetLabel: "Maria Souza",
  details: {},
  createdAt: "2026-11-24T17:03:00.000Z",
  ...over,
});

describe("Texto da auditoria", () => {
  it("frase com o nome do alvo; sem nome, o id; ação sem alvo", () => {
    expect(auditSentence(entry({}))).toBe("bloqueou “Maria Souza”");
    expect(auditSentence(entry({ targetLabel: null }))).toBe("bloqueou #u2");
    expect(auditSentence(entry({ action: "site.publish", targetType: "site", targetId: null, targetLabel: null }))).toBe("publicou o site");
    expect(auditSentence(entry({ action: "song.upload-file", targetLabel: "Glória", details: { kind: "audio" } }))).toBe("enviou o áudio de “Glória”");
  });

  it("detalhes: motivo, campos em português, papel e decisão", () => {
    expect(auditDetails(entry({ details: { reason: "Conta duplicada" } }))).toBe("Motivo: Conta duplicada");
    expect(auditDetails(entry({ details: { fields: ["lyrics", "title"] } }))).toBe("Alterou: letra, título");
    expect(auditDetails(entry({ details: { fields: ["roles"], roles: ["admin", "musico"] } }))).toBe("Alterou: papel · Papel: Administrador");
    expect(auditDetails(entry({ details: { decision: "ignore", songId: null } }))).toBe("Decisão: ignorou");
    expect(auditDetails(entry({ details: { reason: null } }))).toBeNull();
  });

  it("ação desconhecida (versão nova da API) aparece pelo código", () => {
    expect(auditSentence(entry({ action: "x.nova", targetLabel: "Y" }))).toBe("x.nova");
  });
});
