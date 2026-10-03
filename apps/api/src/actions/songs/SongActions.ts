import { randomUUID } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { FILE_MEDIA_FIELD, songSlug, type Song, type SongFileKind } from "../../domain/song.js";
import { toSongDTO, toSongSummaryDTO, type SongBody, type SongDTO, type SongPatch, type SongSummaryDTO } from "../../dtos/song.dto.js";
import type { FileStorage, FlagRepository, MassRepository, SongData, SongFilters, SongRepository } from "../../interfaces/index.js";

type Deps = { songs: SongRepository; flags: FlagRepository };

async function assertFlags(flags: FlagRepository, ids: number[]) {
  const unique = [...new Set(ids)];
  const found = new Set((await flags.findByIds(unique)).map((f) => f.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length) throw new AppError("VALIDATION_ERROR", "Há flags que não existem.", { unknownFlagIds: missing });
  return unique;
}

export class ListSongsAction {
  constructor(private readonly deps: Deps) {}
  /** Repertório público só com cantos ativos; o admin vê também os ocultos. */
  async execute(filters: Omit<SongFilters, "includeInactive"> & { full?: boolean }, opts: { includeInactive: boolean }) {
    const { full, ...rest } = filters;
    const { songs, total } = await this.deps.songs.list({ ...rest, includeInactive: opts.includeInactive });
    const list: (SongDTO | SongSummaryDTO)[] = songs.map(full ? toSongDTO : toSongSummaryDTO);
    return { songs: list, total, page: rest.page, pageSize: rest.pageSize };
  }
}

export class GetSongAction {
  constructor(private readonly deps: Deps) {}
  /** `ref` é o id ("77") ou o slug ("077-…"). Canto oculto só aparece para o admin. */
  async execute(ref: string, opts: { includeInactive: boolean }): Promise<SongDTO> {
    const song = /^\d+$/.test(ref) ? await this.deps.songs.findById(Number(ref)) : await this.deps.songs.findBySlug(ref);
    if (!song || (!song.active && !opts.includeInactive)) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    return toSongDTO(song);
  }
}

export class CreateSongAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, body: SongBody): Promise<SongDTO> {
    const data: SongData = { ...body, slug: body.slug ?? songSlug(body.title, body.number), flagIds: await assertFlags(this.deps.flags, body.flagIds) };
    return toSongDTO(await this.deps.songs.create(data, userId));
  }
}

/** PUT manda o canto inteiro; PATCH só o que mudou. O slug não muda sozinho ao trocar o título (links continuam valendo). */
export class UpdateSongAction {
  constructor(private readonly deps: Deps) {}
  async execute(userId: string, id: number, changes: SongBody | SongPatch): Promise<SongDTO> {
    const current = await this.deps.songs.findById(id);
    if (!current) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    const data: SongData = {
      number: changes.number !== undefined ? changes.number : current.number,
      slug: changes.slug ?? current.slug,
      title: changes.title ?? current.title,
      composer: changes.composer !== undefined ? changes.composer : current.composer,
      key: changes.key !== undefined ? changes.key : current.key,
      lyrics: changes.lyrics ?? current.lyrics,
      media: { ...current.media, ...changes.media },
      flagIds: changes.flagIds ? await assertFlags(this.deps.flags, changes.flagIds) : current.flags.map((f) => f.id),
      active: changes.active ?? current.active,
    };
    return toSongDTO((await this.deps.songs.update(id, data, userId))!);
  }
}

/** Canto que está em alguma missa não é excluído (a missa ficaria com um buraco): use active=false para ocultar. */
export class DeleteSongAction {
  constructor(private readonly deps: Deps & { masses: MassRepository; storage: FileStorage }) {}
  async execute(id: number): Promise<void> {
    const song = await this.deps.songs.findById(id);
    if (!song) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    const uses = await this.deps.masses.countSongUsage(id);
    if (uses)
      throw new AppError("SONG_IN_USE", `Este canto está em ${uses} missa(s). Para tirá-lo do repertório, oculte-o (active: false).`, { masses: uses });
    await this.deps.songs.delete(id);
    await deleteOwnFiles(this.deps.storage, song);
  }
}

/** Apaga do storage só os arquivos enviados por nós (links externos, como os do site antigo, ficam). */
async function deleteOwnFiles(storage: FileStorage, song: Song) {
  for (const url of [song.media.audio, song.media.cifraPdf, song.media.partituraPdf])
    if (url?.includes("/songs/")) await storage.delete(url).catch(() => undefined);
}

export const SONG_FILE_MAX_BYTES = Number(process.env.SONG_FILE_MAX_MB ?? 4) * 1024 * 1024;

/** Identifica o tipo pelos primeiros bytes; o nome e o Content-Type do cliente não são confiáveis. */
export function sniffSongFile(kind: SongFileKind, b: Buffer): { ext: string; contentType: string } | null {
  if (kind !== "audio") return b.subarray(0, 5).toString("latin1") === "%PDF-" ? { ext: "pdf", contentType: "application/pdf" } : null;
  if (b.subarray(0, 3).toString("latin1") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))
    return { ext: "mp3", contentType: "audio/mpeg" };
  if (b.subarray(4, 8).toString("latin1") === "ftyp") return { ext: "m4a", contentType: "audio/mp4" };
  if (b.subarray(0, 4).toString("latin1") === "OggS") return { ext: "ogg", contentType: "audio/ogg" };
  return null;
}

/** Envia (ou troca) o PDF da cifra, o PDF da partitura ou o áudio do canto. */
export class UploadSongFileAction {
  constructor(private readonly deps: Deps & { storage: FileStorage }) {}
  async execute(userId: string, id: number, kind: SongFileKind, data: Buffer): Promise<SongDTO> {
    const type = sniffSongFile(kind, data);
    if (!type) throw new AppError("INVALID_FILE", kind === "audio" ? "Envie um áudio MP3, M4A ou OGG." : "Envie um arquivo PDF.");
    if (data.length > SONG_FILE_MAX_BYTES)
      throw new AppError("INVALID_FILE", `O arquivo pode ter no máximo ${SONG_FILE_MAX_BYTES / 1024 / 1024} MB.`);

    const song = await this.deps.songs.findById(id);
    if (!song) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    const field = FILE_MEDIA_FIELD[kind];
    const url = await this.deps.storage.put(`songs/${id}/${kind}-${randomUUID()}.${type.ext}`, data, type.contentType);
    const updated = await this.deps.songs.setMedia(id, field, url, userId);
    const old = song.media[field];
    if (old?.includes("/songs/")) await this.deps.storage.delete(old).catch(() => undefined);
    return toSongDTO(updated!);
  }
}

export class RemoveSongFileAction {
  constructor(private readonly deps: Deps & { storage: FileStorage }) {}
  async execute(userId: string, id: number, kind: SongFileKind): Promise<SongDTO> {
    const song = await this.deps.songs.findById(id);
    if (!song) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    const field = FILE_MEDIA_FIELD[kind];
    const old = song.media[field];
    const updated = await this.deps.songs.setMedia(id, field, null, userId);
    if (old?.includes("/songs/")) await this.deps.storage.delete(old).catch(() => undefined);
    return toSongDTO(updated!);
  }
}
