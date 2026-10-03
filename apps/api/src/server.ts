import { mkdirSync } from "node:fs";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { buildContainer, createAdapters, UPLOADS_DIR } from "./container.js";

// Ponto de entrada local e na Vercel (que detecta src/server.ts e roda como uma Function).
const env = loadEnv();
const adapters = createAdapters(env);
const useLocalUploads = !env.BLOB_READ_WRITE_TOKEN;
if (useLocalUploads) mkdirSync(UPLOADS_DIR, { recursive: true });

const app = await buildApp({ container: buildContainer(env, adapters), uploadsDir: useLocalUploads ? UPLOADS_DIR : undefined });

app.addHook("onClose", () => adapters.pool.end());

app.listen({ port: env.PORT, host: env.HOST }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
