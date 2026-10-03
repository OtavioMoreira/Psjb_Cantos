import type { FastifyInstance } from "fastify";
import type { Container } from "../container.js";
import { AdminUserController } from "../controllers/AdminUserController.js";
import { AuthController } from "../controllers/AuthController.js";
import { MassController } from "../controllers/MassController.js";
import { MovementController } from "../controllers/MovementController.js";
import { SongController } from "../controllers/SongController.js";
import { UserController } from "../controllers/UserController.js";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { healthRoutes } from "./health.js";

/** Todas as rotas da API, sob o prefixo /api. Cada rota só liga middleware → controller. */
export async function routes(app: FastifyInstance, { container }: { container: Container }) {
  // Limites por IP nas rotas sensíveis (força bruta e cadastro em massa). Fora de produção ficam
  // 20× maiores, para testes e a coleção do Postman rodarem várias vezes seguidas.
  const factor = container.env.NODE_ENV === "production" ? 1 : 20;
  const strict = (max: number) => ({ config: { rateLimit: { max: max * factor, timeWindow: "15 minutes" } } });

  const auth = new AuthController(container);
  const users = new UserController(container);
  const admin = new AdminUserController(container);
  const movements = new MovementController(container);
  const masses = new MassController(container);
  const songs = new SongController(container);
  const isAuthenticated = authenticate(container.tokens);

  await app.register(healthRoutes);

  // Sessão
  app.post("/auth/login", strict(10), auth.login);
  app.post("/auth/refresh", strict(60), auth.refresh);
  app.post("/auth/logout", auth.logout);

  // Cadastro público e dados da própria conta
  app.post("/users", strict(5), users.create);
  app.get("/movements", movements.list);
  app.get("/me", { preHandler: isAuthenticated }, users.me);
  app.put("/me/photo", { preHandler: isAuthenticated }, users.updatePhoto);

  // Repertório público (só cantos ativos)
  app.get("/songs", songs.list);
  app.get("/songs/:ref", songs.get);
  app.get("/flags", songs.listFlags);

  // Rotas de quem está logado (qualquer papel)
  await app.register(async (logged) => {
    logged.addHook("preHandler", isAuthenticated);

    logged.get("/users/search", users.search);

    logged.get("/masses", masses.list);
    logged.post("/masses", masses.create);
    logged.get("/masses/:id", masses.get);
    logged.put("/masses/:id", masses.replace);
    logged.patch("/masses/:id", masses.patch);
    logged.delete("/masses/:id", masses.remove);
    logged.post("/masses/:id/duplicate", masses.duplicate);
    logged.put("/masses/:id/shares", masses.share);
    logged.delete("/masses/:id/shares/me", masses.leave);
    logged.post("/masses/:id/share-link", masses.createLink);
    logged.delete("/masses/:id/share-link", masses.revokeLink);
    logged.post("/masses/join", strict(30), masses.join);
  });

  // Gestão: só o papel admin
  await app.register(async (adminScope) => {
    adminScope.addHook("preHandler", isAuthenticated);
    adminScope.addHook("preHandler", requireRole("admin"));
    adminScope.get("/users", admin.list);
    adminScope.patch("/users/:id/activate", admin.activate);
    adminScope.post("/movements", movements.create);
    adminScope.patch("/movements/:id", movements.rename);
    adminScope.delete("/movements/:id", movements.remove);

    adminScope.get("/songs", songs.adminList);
    adminScope.get("/songs/:id", songs.adminGet);
    adminScope.post("/songs", songs.create);
    adminScope.put("/songs/:id", songs.replace);
    adminScope.patch("/songs/:id", songs.patch);
    adminScope.delete("/songs/:id", songs.remove);
    adminScope.put("/songs/:id/files/:kind", songs.uploadFile);
    adminScope.delete("/songs/:id/files/:kind", songs.removeFile);

    adminScope.post("/flags", songs.createFlag);
    adminScope.put("/flags/:id", songs.updateFlag);
    adminScope.delete("/flags/:id", songs.removeFlag);
  }, { prefix: "/admin" });
}
