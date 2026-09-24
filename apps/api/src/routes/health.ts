import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => "ok");

  app.get("/test", async () => "API Cantos PSJB funcionando — rota de teste");
};
