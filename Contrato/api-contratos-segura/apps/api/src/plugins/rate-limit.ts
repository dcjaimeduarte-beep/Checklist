import fastifyRateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
    errorResponseBuilder: function (_request, context) {
      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Limite de requisições excedido. Tente novamente em ${context.after}.`
      };
    }
  });
}
