import { env } from "./config/env";
import app from "./app";
import { fecharBanco } from "./database/db";

// Impede que erros não capturados derrubem o processo
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

const server = app.listen(env.port, () => {
  console.log(`[Seven Docs] Backend em http://localhost:${env.port} (${env.nodeEnv})`);
});

function encerrar() {
  server.close(() => {
    fecharBanco();
    process.exit(0);
  });
  setTimeout(() => {
    fecharBanco();
    process.exit(0);
  }, 1500).unref();
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
process.on("SIGBREAK", encerrar);
