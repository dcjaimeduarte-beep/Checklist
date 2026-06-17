import { buildApp } from "./app.js";
import { env } from "./env.js";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./utils/password.js";
import { syncClientsFromFirebird } from "./lib/client-sync.js";
import { startBackupScheduler } from "./modules/backup/backup.service.js";

async function runSync(label: string, log: (msg: string) => void) {
  try {
    const r = await syncClientsFromFirebird();
    if (r.error) {
      log(`[sync-clientes] ${label} — ignorado: ${r.error}`);
    } else {
      log(`[sync-clientes] ${label} — ${r.total} lidos | +${r.created} criados | ~${r.updated} atualizados | ${r.durationMs}ms`);
    }
  } catch (e) {
    log(`[sync-clientes] ${label} — erro inesperado: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function ensureAdminUser(log: (msg: string) => void) {
  try {
    const existing = await prisma.user.findUnique({
      where: { email: env.SEED_ADMIN_EMAIL.toLowerCase() },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          name: env.SEED_ADMIN_NAME,
          email: env.SEED_ADMIN_EMAIL.toLowerCase(),
          passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
          role: env.SEED_ADMIN_ROLE as "admin" | "juridico" | "comercial" | "operador",
          status: "active",
        },
      });
      log(`[seed] Usuário admin criado: ${env.SEED_ADMIN_EMAIL}`);
    }
  } catch (e) {
    log(`[seed] Aviso ao verificar admin: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function start() {
  const app = await buildApp();

  try {
    await app.listen({
      host: env.APP_HOST,
      port: env.APP_PORT
    });

    app.log.info(`API rodando em http://${env.APP_HOST}:${env.APP_PORT}`);

    await ensureAdminUser((msg) => app.log.info(msg));
    void startBackupScheduler((msg) => app.log.info(msg));

    // Sync inicial (aguarda 8s para a conexão Firebird estabilizar)
    setTimeout(() => void runSync("startup", (m) => app.log.info(m)), 8_000);

    // Sync periódico
    const intervalMin = env.FB_CLIENT_SYNC_INTERVAL_MINUTES;
    if (intervalMin > 0) {
      const intervalMs = intervalMin * 60 * 1_000;
      setInterval(() => void runSync(`periódico (${intervalMin}min)`, (m) => app.log.info(m)), intervalMs);
      app.log.info(`[sync-clientes] Sincronização automática a cada ${intervalMin} minuto(s)`);
    } else {
      app.log.info("[sync-clientes] Sincronização automática desativada (FB_CLIENT_SYNC_INTERVAL_MINUTES=0)");
    }
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();
