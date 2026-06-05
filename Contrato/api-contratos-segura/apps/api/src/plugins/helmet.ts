import fastifyHelmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

export async function registerHelmet(app: FastifyInstance) {
  await app.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: false
  });
}
