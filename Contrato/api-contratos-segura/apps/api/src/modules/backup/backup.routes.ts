import type { FastifyInstance } from "fastify";
import { requireRole } from "../../utils/auth-guard.js";
import {
  getBackupConfig,
  saveBackupConfig,
  exportAllData,
  runBackupNow,
  restartScheduler,
  type BackupConfig,
} from "./backup.service.js";

export async function backupRoutes(app: FastifyInstance) {
  // GET /backup/config — retorna configuração atual
  app.get("/backup/config", { preHandler: [requireRole(["admin"])] }, async (_req, reply) => {
    return reply.send(getBackupConfig());
  });

  // PUT /backup/config — salva configuração e reinicia scheduler
  app.put<{ Body: Partial<BackupConfig> }>(
    "/backup/config",
    { preHandler: [requireRole(["admin"])] },
    async (req, reply) => {
      const current = getBackupConfig();
      const updated: BackupConfig = { ...current, ...req.body };
      saveBackupConfig(updated);
      restartScheduler((msg) => app.log.info(msg));
      return reply.send({ ok: true, config: updated });
    }
  );

  // POST /backup/agora — executa backup imediatamente
  app.post("/backup/agora", { preHandler: [requireRole(["admin"])] }, async (_req, reply) => {
    const result = await runBackupNow((msg) => app.log.info(msg));
    return reply.code(result.ok ? 200 : 500).send(result);
  });

  // GET /backup/exportar — download do JSON de backup
  app.get("/backup/exportar", { preHandler: [requireRole(["admin"])] }, async (_req, reply) => {
    const jsonData = await exportAllData();
    const filename = `backup-contratos-${new Date().toISOString().slice(0, 10)}.json`;
    return reply
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Type", "application/json")
      .send(jsonData);
  });
}
