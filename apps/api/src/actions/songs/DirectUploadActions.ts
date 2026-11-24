import { randomUUID } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { FILE_MEDIA_FIELD, type SongFileKind } from "../../domain/song.js";
import { toSongDTO, type SongDTO } from "../../dtos/song.dto.js";
import { supportsDirectUpload, type FileStorage, type SongRepository } from "../../interfaces/index.js";
import { SONG_FILE_MAX_BYTES, sniffSongFile } from "./SongActions.js";

// Arquivos de canto grandes (um MP3 longo passa de 4 MB, o limite do corpo das Functions da Vercel):
// o navegador manda direto para o Blob com um token de uso único, e a API só confere e liga ao canto.

/** Teto do envio direto. O Blob grátis tem 1 GB no total: um MP3 de 25 MB já é generoso. */
export const SONG_FILE_DIRECT_MAX_BYTES = Number(process.env.SONG_FILE_DIRECT_MAX_MB ?? 25) * 1024 * 1024;

const EXT: Record<string, string> = { "application/pdf": "pdf", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg" };

type Deps = { songs: SongRepository; storage: FileStorage };

export type UploadTicket =
  /** Sem envio direto (disco local): use o PUT de sempre, até `maxBytes`. */
  | { mode: "server"; maxBytes: number }
  | { mode: "direct"; token: string; pathname: string; maxBytes: number };

export class CreateSongUploadAction {
  constructor(private readonly deps: Deps) {}

  async execute(id: number, kind: SongFileKind, file: { contentType: string; size: number }): Promise<UploadTicket> {
    const { storage } = this.deps;
    if (!(await this.deps.songs.findById(id))) throw new AppError("NOT_FOUND", "Canto não encontrado.");
    if (!supportsDirectUpload(storage)) return { mode: "server", maxBytes: SONG_FILE_MAX_BYTES };

    const ext = EXT[file.contentType];
    if (!ext || (kind === "audio") === (ext === "pdf"))
      throw new AppError("INVALID_FILE", kind === "audio" ? "Envie um áudio MP3, M4A ou OGG." : "Envie um arquivo PDF.");
    if (file.size > SONG_FILE_DIRECT_MAX_BYTES)
      throw new AppError("INVALID_FILE", `O arquivo pode ter no máximo ${SONG_FILE_DIRECT_MAX_BYTES / 1024 / 1024} MB.`);

    const pathname = `songs/${id}/${kind}-${randomUUID()}.${ext}`;
    const token = await storage.createUploadToken(pathname, { contentTypes: [file.contentType], maxBytes: SONG_FILE_DIRECT_MAX_BYTES });
    return { mode: "direct", token, pathname, maxBytes: SONG_FILE_DIRECT_MAX_BYTES };
  }
}

/**
 * Depois do envio direto: confere que o arquivo é do nosso Blob, no caminho deste canto e deste tipo,
 * e que os bytes são mesmo um PDF ou um áudio. Só então troca o arquivo do canto (e apaga o anterior).
 */
export class AttachSongUploadAction {
  constructor(private readonly deps: Deps) {}

  async execute(userId: string, id: number, kind: SongFileKind, url: string): Promise<SongDTO> {
    const { storage, songs } = this.deps;
    if (!supportsDirectUpload(storage)) throw new AppError("NOT_CONFIGURED", "O envio direto não está disponível neste ambiente.");
    const song = await songs.findById(id);
    if (!song) throw new AppError("NOT_FOUND", "Canto não encontrado.");

    const path = storage.pathOf(url);
    const expected = new RegExp(`^songs/${id}/${kind}-[0-9a-f-]{36}\\.(pdf|mp3|m4a|ogg)$`);
    if (!path || !expected.test(path)) throw new AppError("VALIDATION_ERROR", "Arquivo de outro lugar: envie de novo pelo editor.");

    const { size, firstBytes } = await storage.inspect(url).catch(() => {
      throw new AppError("INVALID_FILE", "O arquivo não foi encontrado. Envie de novo.");
    });
    if (size > SONG_FILE_DIRECT_MAX_BYTES || !sniffSongFile(kind, firstBytes)) {
      await storage.delete(url).catch(() => undefined);
      throw new AppError("INVALID_FILE", kind === "audio" ? "Envie um áudio MP3, M4A ou OGG." : "Envie um arquivo PDF.");
    }

    const field = FILE_MEDIA_FIELD[kind];
    const updated = await songs.setMedia(id, field, url, userId);
    const old = song.media[field];
    if (old && old !== url && old.includes("/songs/")) await storage.delete(old).catch(() => undefined);
    return toSongDTO(updated!);
  }
}
