import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { contractsRoutes } from "./modules/contracts/contracts.routes.js";
import { templatesRoutes } from "./modules/templates/templates.routes.js";
import { contractTypesRoutes } from "./modules/contract-types/contract-types.routes.js";
import { firebirdRoutes } from "./routes/firebird.routes.js";
import { configRoutes } from "./routes/config.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { env } from "./env.js";
import { registerHelmet } from "./plugins/helmet.js";
import { registerJwt } from "./plugins/jwt.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { healthRoutes } from "./routes/health.route.js";
import { protectedRoutes } from "./routes/protected.route.js";
import { registerErrorHandler } from "./utils/error-handler.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.NODE_ENV === "production" ? false : true,
    credentials: true
  });
  await registerHelmet(app);
  await registerRateLimit(app);
  await registerJwt(app);

  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(protectedRoutes);
  await app.register(usersRoutes);
  await app.register(clientsRoutes);
  await app.register(contractsRoutes);
  await app.register(templatesRoutes);
  await app.register(contractTypesRoutes);
  await app.register(firebirdRoutes);
  await app.register(configRoutes);

  return app;
}
