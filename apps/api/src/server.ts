import { mkdirSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./buildApp.js";
import { loadEnv } from "./config/env.js";
import { buildContainer, createAdapters, UPLOADS_DIR } from "./container.js";

// Ponto de entrada local e na Vercel (que procura app.ts, index.ts e server.ts nessa ordem; por isso a montagem da
// aplicação fica em buildApp.ts, e não em app.ts) e roda como uma Function.
const env = loadEnv();
const adapters = createAdapters(env);
const useLocalUploads = !env.BLOB_READ_WRITE_TOKEN;
if (useLocalUploads) mkdirSync(UPLOADS_DIR, { recursive: true });

// A Vercel só aceita como entrada um arquivo que importe "fastify" (regex no texto): por isso o tipo explícito.
const app: FastifyInstance = await buildApp({ container: buildContainer(env, adapters), uploadsDir: useLocalUploads ? UPLOADS_DIR : undefined });

app.addHook("onClose", () => adapters.pool.end());

app.listen({ port: env.PORT, host: env.HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
