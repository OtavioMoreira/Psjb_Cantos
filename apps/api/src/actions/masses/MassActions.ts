import { AppError } from "../../domain/errors.js";
import { toMassDTO, type MassBody, type MassDTO, type MassPatch } from "../../dtos/mass.dto.js";
import type { Mass, MassSlot } from "../../domain/mass.js";
import { hasRole } from "../../domain/user.js";
import { massSharedEmail, massWhen } from "../../emails/templates.js";
import type { EmailSender, MassData, MassFilters, MassRepository, SongRepository, UserRepository } from "../../interfaces/index.js";
import { sendQuietly } from "../auth/emailTokens.js";
import { loadMass } from "./access.js";

// Casos de uso das missas. Todos recebem o id de quem está logado e conferem a permissão aqui,
// não na rota: assim a regra vale igual para qualquer porta de entrada (HTTP, testes, scripts).

type Deps = { masses: MassRepository };

/** Todo songId da missa precisa existir no repertório. */
async function assertSongs(songs: SongRepository, slots: MassSlot[]) {
  const ids = [...new Set(slots.flatMap((s) => s.items.map((i) => i.songId)))];
  const found = new Set(await songs.existingIds(ids));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new AppError("VALIDATION_ERROR", "Há cantos que não existem no repertório.", { unknownSongIds: missing });
}

/** Sugerir uma missa para todos é coisa de admin (a "missa do padre"). */
async function assertCanSuggest(users: UserRepository, userId: string) {
  const user = await users.findById(userId);
  if (!user || !hasRole(user, "admin")) throw new AppError("FORBIDDEN", "Só administradores sugerem missas para todos.");
}

/** A sugestão aparece na semana da data: sem data, não teria quando aparecer. */
function assertSuggestionDate(suggested: boolean, date: string | null) {
  if (suggested && !date)
    throw new AppError("VALIDATION_ERROR", "Confira os dados enviados.", { fields: { date: "Informe a data: a sugestão aparece na semana dela." } });
}

export class ListMassesAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, filters: MassFilters): Promise<MassDTO[]> {
    return (await this.deps.masses.listForUser(userId, filters)).map((m) => toMassDTO(m, userId));
  }
}

export class GetMassAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<MassDTO> {
    const { mass } = await loadMass(this.deps.masses, id, userId);
    return toMassDTO(mass, userId);
  }
}

/**
 * Sugestões da semana para qualquer pessoa logada: de hoje até o domingo (hoje, se for domingo).
 * Só leitura: cada pessoa cria a própria missa com base nela.
 */
export class ListSuggestedMassesAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string): Promise<MassDTO[]> {
    return (await this.deps.masses.listWeekSuggestions()).map((m) => toMassDTO(m, userId));
  }
}

export class CreateMassAction {
  constructor(private readonly deps: Deps & { songs: SongRepository; users: UserRepository }) {}
  async execute(userId: string, body: MassBody & { id?: string }): Promise<MassDTO> {
    const { id, ...data } = body;
    if (data.suggested) await assertCanSuggest(this.deps.users, userId);
    assertSuggestionDate(data.suggested, data.date);
    await assertSongs(this.deps.songs, data.slots);
    return toMassDTO(await this.deps.masses.create(userId, data, id), userId);
  }
}

/**
 * PUT manda a missa inteira; PATCH só os campos que mudaram. Dono e convidados podem editar.
 * Ligar ou desligar a sugestão para todos é só do dono, e o dono precisa ser admin.
 * Com `expectedVersion` (If-Match), recusa com 409 MASS_CONFLICT se outra pessoa salvou antes,
 * devolvendo a missa atual para o front juntar as alterações.
 */
export class UpdateMassAction {
  constructor(private readonly deps: Deps & { songs: SongRepository; users: UserRepository }) {}
  async execute(userId: string, id: string, changes: MassBody | MassPatch, expectedVersion?: number): Promise<MassDTO> {
    const { mass, access } = await loadMass(this.deps.masses, id, userId);
    const conflict = (current: Mass) =>
      new AppError("MASS_CONFLICT", `${current.updatedBy?.name ?? "Outra pessoa"} alterou esta missa enquanto você editava.`, {
        mass: toMassDTO(current, userId),
      });
    if (expectedVersion !== undefined && expectedVersion !== mass.version) throw conflict(mass);
    const data: MassData = {
      name: changes.name ?? mass.name,
      date: changes.date !== undefined ? changes.date : mass.date,
      time: changes.time !== undefined ? changes.time : mass.time,
      season: changes.season !== undefined ? changes.season : mass.season,
      year: changes.year !== undefined ? changes.year : mass.year,
      slots: changes.slots ?? mass.slots,
      suggested: changes.suggested ?? mass.suggested,
    };
    if (data.suggested !== mass.suggested) {
      if (access !== "owner") throw new AppError("FORBIDDEN", "Só quem criou a missa pode sugeri-la para todos.");
      await assertCanSuggest(this.deps.users, userId);
    }
    assertSuggestionDate(data.suggested, data.date);
    if (changes.slots) await assertSongs(this.deps.songs, changes.slots);
    const updated = await this.deps.masses.update(id, data, userId, expectedVersion);
    if (!updated) {
      // Alguém salvou entre a leitura e a gravação.
      const current = await this.deps.masses.findById(id);
      if (current && expectedVersion !== undefined) throw conflict(current);
      throw new AppError("NOT_FOUND", "Missa não encontrada.");
    }
    return toMassDTO(updated, userId);
  }
}

export class DeleteMassAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<void> {
    await loadMass(this.deps.masses, id, userId, { ownerOnly: true, action: "excluir a missa" });
    await this.deps.masses.delete(id);
  }
}

/** Duplicar: a cópia é de quem duplicou, sem data e sem compartilhamento. */
export class DuplicateMassAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<MassDTO> {
    const { mass } = await loadMass(this.deps.masses, id, userId);
    const copy = await this.deps.masses.create(userId, {
      name: `Cópia de ${mass.name || "missa"}`.slice(0, 120),
      date: null,
      time: mass.time,
      season: mass.season,
      year: mass.year,
      slots: mass.slots,
      suggested: false,
    });
    return toMassDTO(copy, userId);
  }
}

/**
 * Define com quem a missa está compartilhada (substitui a lista). Só o dono.
 * Só contas ativas entram; o próprio dono é ignorado. Quem entrou agora recebe um aviso por e-mail.
 */
export class ShareMassAction {
  constructor(private readonly deps: Deps & { users: UserRepository; email: EmailSender; appUrl: string }) {}
  async execute(userId: string, id: string, userIds: string[]): Promise<MassDTO> {
    const { mass } = await loadMass(this.deps.masses, id, userId, { ownerOnly: true, action: "compartilhar a missa" });
    const wanted = [...new Set(userIds)].filter((u) => u !== userId);
    const active = new Set(await this.deps.users.filterActiveIds(wanted));
    const invalid = wanted.filter((u) => !active.has(u));
    if (invalid.length)
      throw new AppError("VALIDATION_ERROR", "Só dá para compartilhar com pessoas que têm conta ativa.", { invalidUserIds: invalid });
    const updated = (await this.deps.masses.setShares(id, wanted))!;
    const before = new Set(mass.sharedWith.map((p) => p.id));
    await this.notify(updated, wanted.filter((u) => !before.has(u)));
    return toMassDTO(updated, userId);
  }

  /** O aviso é cortesia: falha no envio não desfaz o compartilhamento. */
  private async notify(mass: Mass, newIds: string[]) {
    const url = `${this.deps.appUrl}/painel/missas/editar?id=${mass.id}`;
    const massName = mass.name || (mass.date ? `Missa de ${mass.date.slice(8, 10)}/${mass.date.slice(5, 7)}` : "Missa");
    for (const uid of newIds) {
      const user = await this.deps.users.findById(uid);
      if (user)
        await sendQuietly(
          this.deps.email,
          massSharedEmail({ to: user.email, name: user.name, sharedBy: mass.owner.name, massName, when: massWhen(mass.date, mass.time), url }),
        );
    }
  }
}

/** Quem recebeu sai da missa; ela continua existindo para o dono. */
export class LeaveMassAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: string): Promise<void> {
    const { access } = await loadMass(this.deps.masses, id, userId);
    if (access === "owner") throw new AppError("FORBIDDEN", "Você criou esta missa. Para tirá-la da lista, exclua a missa.");
    await this.deps.masses.removeShare(id, userId);
  }
}
