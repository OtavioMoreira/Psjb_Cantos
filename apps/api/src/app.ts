import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { SONG_FILE_MAX_BYTES } from "./actions/songs/SongActions.js";
import { PHOTO_MAX_BYTES } from "./actions/users/UpdateMyPhotoAction.js";
import type { Container } from "./container.js";
import { errorHandler } from "./http/errorHandler.js";
import { routes } from "./routes/index.js";

export interface AppOptions {
  container: Container;
  /** Pasta servida em /uploads (só quando o storage é o disco local). */
  uploadsDir?: string;
  logger?: boolean;
}

export async function buildApp({ container, uploadsDir, logger = true }: AppOptions) {
  const { env } = container;
  // trustProxy: atrás da Vercel o IP real vem no X-Forwarded-For (usado no rate limit).
  const app = Fastify({ logger, trustProxy: true });

  await app.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
  await app.register(cors, {
    origin: env.WEB_ORIGIN.split(",").map((o) => o.trim()),
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  // Teto geral; cada action confere o limite do seu tipo (foto 2 MB, arquivos de canto 4 MB).
  await app.register(multipart, { limits: { fileSize: Math.max(PHOTO_MAX_BYTES, SONG_FILE_MAX_BYTES) + 1, files: 1 } });
  if (uploadsDir) await app.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/", decorateReply: false });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }));

  await app.register(routes, { prefix: "/api", container });
  return app;
}
