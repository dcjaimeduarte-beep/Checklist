import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../utils/auth-guard.js";
import { TemplatesService } from "./templates.service.js";
import { createTemplateSchema, templateIdParamSchema, updateTemplateSchema } from "./templates.schemas.js";

export async function templatesRoutes(app: FastifyInstance) {
  const svc = new TemplatesService(app);

  app.get("/templates", { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.send(await svc.list());
  });

  app.get("/templates/default", { preHandler: [requireAuth] }, async (_req, reply) => {
    const t = await svc.getDefault();
    if (!t) return reply.status(404).send({ message: "Nenhum template padrão definido." });
    return reply.send(t);
  });

  app.get<{ Params: { id: string } }>("/templates/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = templateIdParamSchema.parse(req.params);
    return reply.send(await svc.getById(id));
  });

  app.post("/templates", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = createTemplateSchema.parse(req.body);
    return reply.status(201).send(await svc.create(body));
  });

  app.patch<{ Params: { id: string } }>("/templates/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = templateIdParamSchema.parse(req.params);
    const body = updateTemplateSchema.parse(req.body);
    return reply.send(await svc.update(id, body));
  });

  app.patch<{ Params: { id: string } }>("/templates/:id/set-default", { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = templateIdParamSchema.parse(req.params);
    return reply.send(await svc.setDefault(id));
  });
}
