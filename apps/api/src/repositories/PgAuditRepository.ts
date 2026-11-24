import type { Pool } from "../database/pool.js";
import type { AuditEntry, AuditEntryData, AuditTarget } from "../domain/audit.js";
import type { AuditFilters, AuditRepository } from "../interfaces/index.js";

interface Row {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_type: AuditTarget;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: Date;
}

const toEntry = (r: Row): AuditEntry => ({
  id: Number(r.id),
  actorId: r.actor_id,
  actorName: r.actor_name,
  action: r.action,
  targetType: r.target_type,
  targetId: r.target_id,
  targetLabel: r.target_label,
  details: r.details,
  createdAt: r.created_at,
});

export class PgAuditRepository implements AuditRepository {
  constructor(private readonly pool: Pool) {}

  async record(e: AuditEntryData) {
    await this.pool.query(
      `INSERT INTO audit_log (actor_id, actor_name, action, target_type, target_id, target_label, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [e.actorId, e.actorName.slice(0, 120), e.action, e.targetType, e.targetId, e.targetLabel?.slice(0, 200) ?? null, JSON.stringify(e.details)],
    );
  }

  async list(f: AuditFilters) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (f.targetType) {
      params.push(f.targetType);
      where.push(`target_type = $${params.length}`);
    }
    if (f.targetId) {
      params.push(f.targetId);
      where.push(`target_id = $${params.length}`);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [{ rows }, count] = await Promise.all([
      this.pool.query<Row>(`SELECT * FROM audit_log ${sqlWhere} ORDER BY created_at DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [
        ...params,
        f.pageSize,
        (f.page - 1) * f.pageSize,
      ]),
      this.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM audit_log ${sqlWhere}`, params),
    ]);
    return { entries: rows.map(toEntry), total: count.rows[0].n };
  }
}
