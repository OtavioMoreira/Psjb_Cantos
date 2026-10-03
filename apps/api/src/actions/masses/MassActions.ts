import { AppError } from "../../domain/errors.js";
import { toMassDTO, type MassBody, type MassDTO, type MassPatch } from "../../dtos/mass.dto.js";
import type { MassSlot } from "../../domain/mass.js";
import type { MassData, MassFilters, MassRepository, SongRepository, UserRepository } from "../../interfaces/index.js";
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

export class CreateMassAction {
  constructor(private readonly deps: Deps & { songs: SongRepository }) {}
  async execute(userId: string, body: MassBody & { id?: string }): Promise<MassDTO> {
    const { id, ...data } = body;
    await assertSongs(this.deps.songs, data.slots);
    return toMassDTO(await this.deps.masses.create(userId, data, id), userId);
  }
}

/** PUT manda a missa inteira; PATCH só os campos que mudaram. Dono e convidados podem editar. */
export class UpdateMassAction {
  constructor(private readonly deps: Deps & { songs: SongRepository }) {}
  async execute(userId: string, id: string, changes: MassBody | MassPatch): Promise<MassDTO> {
    const { mass } = await loadMass(this.deps.masses, id, userId);
    const data: MassData = {
      name: changes.name ?? mass.name,
      date: changes.date !== undefined ? changes.date : mass.date,
      time: changes.time !== undefined ? changes.time : mass.time,
      season: changes.season !== undefined ? changes.season : mass.season,
      year: changes.year !== undefined ? changes.year : mass.year,
      slots: changes.slots ?? mass.slots,
    };
    if (changes.slots) await assertSongs(this.deps.songs, changes.slots);
    const updated = await this.deps.masses.update(id, data, userId);
    if (!updated) throw new AppError("NOT_FOUND", "Missa não encontrada.");
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
    });
    return toMassDTO(copy, userId);
  }
}

/**
 * Define com quem a missa está compartilhada (substitui a lista). Só o dono.
 * Só contas ativas entram; o próprio dono é ignorado.
 */
export class ShareMassAction {
  constructor(private readonly deps: Deps & { users: UserRepository }) {}
  async execute(userId: string, id: string, userIds: string[]): Promise<MassDTO> {
    await loadMass(this.deps.masses, id, userId, { ownerOnly: true, action: "compartilhar a missa" });
    const wanted = [...new Set(userIds)].filter((u) => u !== userId);
    const active = new Set(await this.deps.users.filterActiveIds(wanted));
    const invalid = wanted.filter((u) => !active.has(u));
    if (invalid.length)
      throw new AppError("VALIDATION_ERROR", "Só dá para compartilhar com pessoas que têm conta ativa.", { invalidUserIds: invalid });
    const updated = await this.deps.masses.setShares(id, wanted);
    return toMassDTO(updated!, userId);
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
