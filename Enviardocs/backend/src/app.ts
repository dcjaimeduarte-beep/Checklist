import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { runMigrations } from "./database/schema";
import { getDb } from "./database/db";
import envioRoutes from "./routes/envio.routes";
import clienteRoutes from "./routes/cliente.routes";
import configRoutes from "./routes/config.routes";
import { errorMiddleware } from "./middlewares/error.middleware";
import { apiKeyMiddleware } from "./middlewares/apiKey.middleware";

const app = express();

// Garante tabelas antes de qualquer requisição
runMigrations();

app.use(helmet());
app.disable("x-powered-by");

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
}));

app.use(express.json({ limit: "16kb" }));

app.use(rateLimit({
  windowMs: env.rateLimit.windowMs,
  max:      env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:     (req) => req.path === "/health",
  message: { erro: "Muitas requisições. Tente novamente em breve." },
}));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api/status", apiKeyMiddleware, (req, res) => {
  const db = getDb();
  const { total } = db.prepare(
    "SELECT COUNT(*) as total FROM clients WHERE active = 1"
  ).get() as { total: number };

  const semEmail = (db.prepare(
    `SELECT COUNT(DISTINCT c.id) as total FROM clients c
     LEFT JOIN client_emails e ON e.client_id = c.id
     WHERE c.active = 1 AND e.id IS NULL`
  ).get() as { total: number }).total;

  const mes = (req.query.mes as string) ?? "";
  const filtroMes = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);

  const enviosQuery = filtroMes
    ? `SELECT sl.id, sl.month, sl.files_count, sl.status, sl.error_message,
              sl.sent_at, c.name as cliente
       FROM send_log sl
       JOIN clients c ON c.id = sl.client_id
       WHERE sl.month = ?
       ORDER BY sl.sent_at DESC`
    : `SELECT sl.id, sl.month, sl.files_count, sl.status, sl.error_message,
              sl.sent_at, c.name as cliente
       FROM send_log sl
       JOIN clients c ON c.id = sl.client_id
       ORDER BY sl.sent_at DESC
       LIMIT 50`;

  const envios = filtroMes
    ? db.prepare(enviosQuery).all(mes)
    : db.prepare(enviosQuery).all();

  // Resumo do mês filtrado
  const resumoMes = filtroMes ? (() => {
    const r = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as enviados,
        SUM(CASE WHEN status = 'error'   THEN 1 ELSE 0 END) as erros,
        SUM(files_count) as arquivos
      FROM send_log WHERE month = ?
    `).get(mes) as { total: number; enviados: number; erros: number; arquivos: number };
    return r;
  })() : null;

  res.json({
    storageDir:    env.storageDir,
    totalClientes: total,
    semEmail,
    ultimosEnvios: envios,
    resumoMes,
  });
});

app.use("/api/envios",   envioRoutes);
app.use("/api/clientes", clienteRoutes);
app.use("/api/config",   configRoutes);

app.use(errorMiddleware);

export default app;
