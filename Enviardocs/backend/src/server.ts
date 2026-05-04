import { env } from "./config/env";
import app from "./app";

// Impede que erros não capturados derrubem o processo
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection:", reason);
});

app.listen(env.port, () => {
  console.log(`[Seven Docs] Backend em http://localhost:${env.port} (${env.nodeEnv})`);
});
