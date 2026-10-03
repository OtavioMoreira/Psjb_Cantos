import type { FastifyReply, FastifyRequest } from "fastify";
import type { Container } from "../container.js";
import { AppError } from "../domain/errors.js";
import {
  flagBodySchema,
  flagIdParamSchema,
  listSongsQuerySchema,
  songBodySchema,
  songFileParamSchema,
  songIdParamSchema,
  songPatchSchema,
  songRefParamSchema,
} from "../dtos/song.dto.js";
import { validate } from "../http/validate.js";
import { requireAuth } from "../middlewares/auth.js";

/** Repertório (público) e gestão de cantos e flags (admin, sob /admin). */
export class SongController {
  constructor(private readonly c: Container) {}

  private id = (req: FastifyRequest) => validate(songIdParamSchema, req.params).id;

  // Público: só cantos ativos
  list = async (req: FastifyRequest) => this.c.actions.listSongs.execute(validate(listSongsQuerySchema, req.query), { includeInactive: false });
  get = async (req: FastifyRequest) => ({
    song: await this.c.actions.getSong.execute(validate(songRefParamSchema, req.params).ref, { includeInactive: false }),
  });
  listFlags = async () => ({ flags: await this.c.actions.listFlags.execute() });

  // Admin: vê também os ocultos
  adminList = async (req: FastifyRequest) => this.c.actions.listSongs.execute(validate(listSongsQuerySchema, req.query), { includeInactive: true });
  adminGet = async (req: FastifyRequest) => ({ song: await this.c.actions.getSong.execute(String(this.id(req)), { includeInactive: true }) });

  create = async (req: FastifyRequest, reply: FastifyReply) => {
    const song = await this.c.actions.createSong.execute(requireAuth(req).userId, validate(songBodySchema, req.body));
    return reply.status(201).send({ song });
  };
  replace = async (req: FastifyRequest) => ({
    song: await this.c.actions.updateSong.execute(requireAuth(req).userId, this.id(req), validate(songBodySchema, req.body)),
  });
  patch = async (req: FastifyRequest) => ({
    song: await this.c.actions.updateSong.execute(requireAuth(req).userId, this.id(req), validate(songPatchSchema, req.body)),
  });
  remove = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.deleteSong.execute(this.id(req));
    return reply.status(204).send();
  };

  /** multipart/form-data com o campo "file". kind = cifra-pdf | partitura-pdf | audio. */
  uploadFile = async (req: FastifyRequest) => {
    const { id, kind } = validate(songFileParamSchema, req.params);
    const file = await req.file();
    if (!file || file.fieldname !== "file") throw new AppError("VALIDATION_ERROR", 'Envie o arquivo no campo "file".');
    let data: Buffer;
    try {
      data = await file.toBuffer();
    } catch {
      throw new AppError("INVALID_FILE", "Arquivo grande demais.");
    }
    return { song: await this.c.actions.uploadSongFile.execute(requireAuth(req).userId, id, kind, data) };
  };
  removeFile = async (req: FastifyRequest) => {
    const { id, kind } = validate(songFileParamSchema, req.params);
    return { song: await this.c.actions.removeSongFile.execute(requireAuth(req).userId, id, kind) };
  };

  createFlag = async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(201).send({ flag: await this.c.actions.createFlag.execute(validate(flagBodySchema, req.body)) });
  };
  updateFlag = async (req: FastifyRequest) => ({
    flag: await this.c.actions.updateFlag.execute(validate(flagIdParamSchema, req.params).id, validate(flagBodySchema, req.body)),
  });
  /** 202: o build foi pedido; o site leva alguns minutos para atualizar. */
  publishSite = async (_req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.publishSite.execute();
    return reply.status(202).send({ ok: true });
  };

  removeFlag = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.c.actions.deleteFlag.execute(validate(flagIdParamSchema, req.params).id);
    return reply.status(204).send();
  };
}
