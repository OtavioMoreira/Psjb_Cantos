import type { FastifyInstance } from "fastify";
import type { Container } from "../container.js";
import { AdminUserController } from "../controllers/AdminUserController.js";
import { AuthController } from "../controllers/AuthController.js";
import { ImportController } from "../controllers/ImportController.js";
import { MassController } from "../controllers/MassController.js";
import { MovementController } from "../controllers/MovementController.js";
import { SongController } from "../controllers/SongController.js";
import { UserController } from "../controllers/UserController.js";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { cronGuard } from "../middlewares/cron.js";
import { registerAudit } from "../http/audit.js";
import { auditQuerySchema } from "../dtos/audit.dto.js";
import { validate } from "../http/validate.js";
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
  const imports = new ImportController(container);
  const isAuthenticated = authenticate(container.tokens);

  await app.register(healthRoutes);

  // Sessão
  app.post("/auth/login", strict(10), auth.login);
  app.post("/auth/login/verify", strict(20), auth.verifyCode);
  app.post("/auth/login/resend", strict(10), auth.resendCode);
  app.post("/auth/refresh", strict(60), auth.refresh);
  app.post("/auth/logout", auth.logout);
  app.post("/auth/password", { preHandler: isAuthenticated, ...strict(10) }, auth.changePassword);
  app.post("/auth/forgot", strict(5), auth.forgot);
  app.post("/auth/reset", strict(10), auth.reset);
  app.post("/auth/confirm-email", strict(10), users.confirmEmailChange);

  // Cadastro público e dados da própria conta
  app.post("/users", strict(5), users.create);
  app.get("/movements", movements.list);
  app.get("/me", { preHandler: isAuthenticated }, users.me);
  app.patch("/me", { preHandler: isAuthenticated }, users.updateMe);
  app.post("/me/email", { preHandler: isAuthenticated, ...strict(10) }, users.requestEmailChange);
  app.put("/me/photo", { preHandler: isAuthenticated }, users.updatePhoto);

  // Repertório público (só cantos ativos)
  app.get("/songs", songs.list);
  app.get("/songs/:ref", songs.get);
  app.get("/flags", songs.listFlags);

  // Cron da Vercel: protegido pelo CRON_SECRET, não pelo login. Salmos de segunda a quinta às 3h; faxina todo dia às 4h.
  const cron = { preHandler: cronGuard(container.env.CRON_SECRET), ...strict(10) };
  app.get("/cron/import-psalms", cron, imports.cron);
  app.get("/cron/cleanup", cron, async () => ({ ok: true, removed: await container.actions.cleanup.execute() }));

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
    registerAudit(adminScope, container);
    adminScope.get("/audit", async (req) => container.actions.listAudit.execute(validate(auditQuerySchema, req.query)));
    adminScope.get("/users", admin.list);
    adminScope.post("/users/invite", strict(30), admin.invite);
    adminScope.post("/users/invite/bulk", strict(5), admin.inviteBulk);
    adminScope.post("/users/:id/invite", strict(30), admin.resendInvite);
    adminScope.post("/users/:id/reset-link", strict(30), admin.sendResetLink);
    adminScope.patch("/users/:id/activate", admin.activate);
    adminScope.patch("/users/:id", admin.update);
    adminScope.post("/users/:id/block", admin.block);
    adminScope.post("/users/:id/unblock", admin.unblock);
    adminScope.post("/users/:id/reset-password", admin.resetPassword);
    adminScope.delete("/users/:id", admin.remove);
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
    adminScope.post("/songs/:id/files/:kind/upload", songs.uploadTicket);
    adminScope.put("/songs/:id/files/:kind/blob", songs.attachUpload);
    adminScope.delete("/songs/:id/files/:kind", songs.removeFile);

    adminScope.post("/flags", songs.createFlag);
    adminScope.put("/flags/:id", songs.updateFlag);
    adminScope.delete("/flags/:id", songs.removeFlag);

    adminScope.post("/site/publish", strict(10), songs.publishSite);
    adminScope.get("/site/status", songs.siteStatus);

    adminScope.get("/imports", imports.list);
    adminScope.post("/imports/run", strict(10), imports.run);
    adminScope.patch("/imports/:id", imports.resolve);
  }, { prefix: "/admin" });
}
