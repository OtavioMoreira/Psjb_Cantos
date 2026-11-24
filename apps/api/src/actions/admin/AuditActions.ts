import type { AuditEntry, AuditEntryData, AuditTarget } from "../../domain/audit.js";
import type { AuditFilters, AuditRepository, FlagRepository, MovementRepository, SongRepository, UserRepository } from "../../interfaces/index.js";

type Deps = { audit: AuditRepository; users: UserRepository; songs: SongRepository; flags: FlagRepository; movements: MovementRepository };

/** Grava uma ação de admin. O nome de quem fez fica junto, para continuar legível se a conta for excluída. */
export class RecordAuditAction {
  constructor(private readonly deps: Deps) {}

  async execute(entry: Omit<AuditEntryData, "actorName"> & { actorId: string }): Promise<void> {
    const actor = await this.deps.users.findById(entry.actorId);
    await this.deps.audit.record({ ...entry, actorName: actor?.name ?? "Administrador" });
  }
}

/** Nome do alvo antes de uma exclusão (depois não há mais como buscar). */
export class AuditTargetLabelAction {
  constructor(private readonly deps: Deps) {}

  async execute(target: AuditTarget, id: string): Promise<string | null> {
    const { users, songs, movements, flags } = this.deps;
    if (target === "user") return (await users.findById(id))?.name ?? null;
    if (target === "song") return (await songs.findById(Number(id)))?.title ?? null;
    if (target === "movement") return (await movements.findById(Number(id)))?.name ?? null;
    if (target === "flag") return (await flags.findByIds([Number(id)]))[0]?.name ?? null;
    return null;
  }
}

export interface AuditEntryDTO extends Omit<AuditEntry, "createdAt"> {
  createdAt: string;
}

/** Admin › Auditoria: mais recentes primeiro, paginado. */
export class ListAuditAction {
  constructor(private readonly deps: Deps) {}

  async execute(filters: AuditFilters): Promise<{ entries: AuditEntryDTO[]; total: number; page: number; pageSize: number }> {
    const { entries, total } = await this.deps.audit.list(filters);
    return { entries: entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })), total, page: filters.page, pageSize: filters.pageSize };
  }
}
