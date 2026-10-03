import { randomUUID } from "node:crypto";
import { AppError } from "../../domain/errors.js";
import { toUserDTO, type UserDTO } from "../../dtos/user.dto.js";
import type { FileStorage, UserRepository } from "../../interfaces/index.js";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Identifica o tipo pelos primeiros bytes; o Content-Type enviado pelo cliente não é confiável. */
export function sniffImage(data: Buffer): { ext: string; contentType: string } | null {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { ext: "jpg", contentType: "image/jpeg" };
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", contentType: "image/png" };
  if (data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP")
    return { ext: "webp", contentType: "image/webp" };
  return null;
}

/** Troca a foto do perfil. A foto antiga é apagada do storage depois que a nova foi salva. */
export class UpdateMyPhotoAction {
  constructor(private readonly deps: { users: UserRepository; storage: FileStorage }) {}

  async execute(userId: string, data: Buffer): Promise<UserDTO> {
    const type = sniffImage(data);
    if (!type) throw new AppError("INVALID_FILE", "Envie uma imagem JPG, PNG ou WebP.");
    if (data.length > PHOTO_MAX_BYTES) throw new AppError("INVALID_FILE", "A foto pode ter no máximo 2 MB.");

    const current = await this.deps.users.findById(userId);
    if (!current) throw new AppError("NOT_FOUND", "Usuário não encontrado.");

    // Nome aleatório: a URL muda a cada troca, então o cache do navegador nunca mostra a foto antiga.
    const url = await this.deps.storage.put(`users/${userId}/${randomUUID()}.${type.ext}`, data, type.contentType);
    const updated = await this.deps.users.updatePhoto(userId, url);
    if (current.photoUrl) await this.deps.storage.delete(current.photoUrl).catch(() => undefined);
    return toUserDTO(updated!);
  }
}
