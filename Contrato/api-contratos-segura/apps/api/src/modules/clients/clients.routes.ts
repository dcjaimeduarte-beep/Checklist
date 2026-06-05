import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole, getAuthUser } from "../../utils/auth-guard.js";
import { ClientsController } from "./clients.controller.js";
import { ClientsService } from "./clients.service.js";
import { syncClientsFromFirebird, getLastSyncResult } from "../../lib/client-sync.js";

export async function clientsRoutes(app: FastifyInstance) {
  const clientsService = new ClientsService(app);
  const clientsController = new ClientsController(clientsService);

  app.get("/clients", { preHandler: [requireAuth] }, async (req, reply) => {
    const authUser = getAuthUser(req);
    if (authUser.revendaId) {
      (req.query as Record<string, unknown>).revendaId = authUser.revendaId;
    }
    return clientsController.list(req, reply);
  });
  app.get("/clients/:id", { preHandler: [requireAuth] }, clientsController.getById);
  app.post("/clients", { preHandler: [requireRole(["admin", "comercial", "revenda"])] }, clientsController.create);
  app.patch("/clients/:id", { preHandler: [requireRole(["admin", "comercial", "revenda"])] }, clientsController.update);
  app.patch("/clients/:id/status", { preHandler: [requireRole(["admin"])] }, clientsController.updateStatus);

  // ── Importar clientes do Firebird (manual) ───────────────────────────────
  app.post("/clients/import-from-firebird", { preHandler: [requireRole(["admin"])] }, async (_req, reply) => {
    const result = await syncClientsFromFirebird();
    if (result.error) {
      return reply.status(503).send({ message: result.error });
    }
    return reply.send(result);
  });

  // ── Status da última sincronização ────────────────────────────────────────
  app.get("/clients/sync-status", { preHandler: [requireAuth] }, async (_req, reply) => {
    const result = await getLastSyncResult();
    return reply.send(result ?? { ranAt: null });
  });
}
