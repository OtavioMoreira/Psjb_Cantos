import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import type { AuditTarget } from "../domain/audit.js";

// Auditoria das rotas de admin, num hook só: toda alteração que deu certo (não-GET, 2xx) vira um
// registro. Rota de admin nova sem regra aqui faz o teste de auditoria falhar, de propósito.

interface Rule {
  action: string;
  target: AuditTarget;
  /** Detalhes vindos do corpo da requisição (só campos seguros). */
  details?: (body: Record<string, unknown>, params: Record<string, string>) => Record<string, unknown>;
}

/** Só os nomes dos campos alterados, nunca os valores (a letra é longa; a senha, secreta). */
const fieldsOf = (body: Record<string, unknown>) => ({ fields: Object.keys(body).sort() });

export const AUDIT_RULES: Record<string, Rule> = {
  "POST /users/invite": { action: "user.invite", target: "user", details: (b) => ({ email: b.email, roles: b.roles }) },
  "POST /users/:id/invite": { action: "user.resend-invite", target: "user" },
  "POST /users/:id/reset-link": { action: "user.reset-link", target: "user" },
  "PATCH /users/:id/activate": { action: "user.activate", target: "user" },
  "PATCH /users/:id": { action: "user.update", target: "user", details: (b) => ({ ...fieldsOf(b), ...(b.roles ? { roles: b.roles } : {}) }) },
  "POST /users/:id/block": { action: "user.block", target: "user", details: (b) => ({ reason: b.reason ?? null }) },
  "POST /users/:id/unblock": { action: "user.unblock", target: "user" },
  "POST /users/:id/reset-password": { action: "user.temporary-password", target: "user" },
  "DELETE /users/:id": { action: "user.delete", target: "user" },
  "POST /movements": { action: "movement.create", target: "movement" },
  "PATCH /movements/:id": { action: "movement.rename", target: "movement" },
  "DELETE /movements/:id": { action: "movement.delete", target: "movement" },
  "POST /songs": { action: "song.create", target: "song" },
  "PUT /songs/:id": { action: "song.update", target: "song" },
  "PATCH /songs/:id": { action: "song.update", target: "song", details: fieldsOf },
  "DELETE /songs/:id": { action: "song.delete", target: "song" },
  "PUT /songs/:id/files/:kind": { action: "song.upload-file", target: "song", details: (_b, p) => ({ kind: p.kind }) },
  "DELETE /songs/:id/files/:kind": { action: "song.remove-file", target: "song", details: (_b, p) => ({ kind: p.kind }) },
  "POST /flags": { action: "flag.create", target: "flag" },
  "PUT /flags/:id": { action: "flag.update", target: "flag" },
  "DELETE /flags/:id": { action: "flag.delete", target: "flag" },
  "POST /site/publish": { action: "site.publish", target: "site" },
  "POST /imports/run": { action: "import.run", target: "import" },
  "PATCH /imports/:id": { action: "import.resolve", target: "import", details: (b) => ({ decision: b.action, songId: b.songId ?? null }) },
};

/** Nome legível do alvo na resposta da rota ({ user }, { song }, { flag }...). */
function labelFrom(payload: unknown): string | null {
  if (typeof payload !== "string" || !payload.startsWith("{")) return null;
  try {
    const json = JSON.parse(payload) as Record<string, { name?: string; title?: string } | undefined>;
    const entity = json.user ?? json.song ?? json.flag ?? json.movement ?? json.item;
    return entity?.name ?? entity?.title ?? null;
  } catch {
    return null;
  }
}

const ruleKey = (req: FastifyRequest) => `${req.method} ${(req.routeOptions.url ?? "").replace(/^.*?\/admin/, "")}`;

declare module "fastify" {
  interface FastifyRequest {
    auditLabel?: string | null;
  }
}

export function registerAudit(scope: FastifyInstance, c: Container) {
  scope.addHook("preHandler", async (req) => {
    const rule = AUDIT_RULES[ruleKey(req)];
    const id = (req.params as { id?: string }).id;
    // Na exclusão (e na remoção de arquivo, que devolve só o canto), o nome vem de antes.
    if (rule && id && req.method === "DELETE") req.auditLabel = await c.actions.auditTargetLabel.execute(rule.target, id).catch(() => null);
  });

  scope.addHook("onSend", async (req, reply, payload) => {
    if (req.method === "GET" || reply.statusCode >= 300 || !req.auth) return payload;
    const rule = AUDIT_RULES[ruleKey(req)];
    if (!rule) return payload;
    const params = (req.params ?? {}) as Record<string, string>;
    let targetId: string | null = params.id ?? null;
    if (!targetId) {
      // Criação: o id vem na resposta.
      try {
        const json = JSON.parse(String(payload)) as Record<string, { id?: string | number } | undefined>;
        const entity = json.user ?? json.song ?? json.flag ?? json.movement;
        targetId = entity?.id != null ? String(entity.id) : null;
      } catch {
        /* resposta sem JSON */
      }
    }
    try {
      await c.actions.recordAudit.execute({
        actorId: req.auth.userId,
        action: rule.action,
        targetType: rule.target,
        targetId,
        targetLabel: req.auditLabel ?? labelFrom(payload),
        details: rule.details?.((req.body ?? {}) as Record<string, unknown>, params) ?? {},
      });
    } catch (err) {
      // A auditoria nunca derruba a ação que já foi feita.
      req.log.error({ err }, "Falha ao gravar a auditoria");
    }
    return payload;
  });
}
