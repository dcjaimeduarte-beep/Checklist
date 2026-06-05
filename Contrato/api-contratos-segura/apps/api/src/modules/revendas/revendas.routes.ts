import type { FastifyInstance } from "fastify";
import { requireRole } from "../../utils/auth-guard.js";
import { prisma } from "../../lib/prisma.js";

export async function revendasRoutes(app: FastifyInstance) {

  app.get("/revendas", { preHandler: [requireRole(["admin"])] }, async (_req, reply) => {
    const revendas = await prisma.revenda.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { clients: true, users: true } },
      },
    });
    return reply.send(revendas);
  });

  app.get<{ Params: { id: string } }>(
    "/revendas/:id",
    { preHandler: [requireRole(["admin"])] },
    async (req, reply) => {
      const revenda = await prisma.revenda.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { clients: true, users: true } } },
      });
      if (!revenda) return reply.status(404).send({ message: "Revenda não encontrada." });
      return reply.send(revenda);
    }
  );

  app.post<{ Body: { name: string; contactName?: string; email?: string; phone?: string } }>(
    "/revendas",
    { preHandler: [requireRole(["admin"])] },
    async (req, reply) => {
      const { name, contactName, email, phone } = req.body ?? {};
      if (!name?.trim()) return reply.status(400).send({ message: "Nome é obrigatório." });
      const revenda = await prisma.revenda.create({
        data: { name: name.trim(), contactName, email, phone },
      });
      return reply.status(201).send(revenda);
    }
  );

  app.patch<{ Params: { id: string }; Body: { name?: string; contactName?: string; email?: string; phone?: string } }>(
    "/revendas/:id",
    { preHandler: [requireRole(["admin"])] },
    async (req, reply) => {
      const { name, contactName, email, phone } = req.body ?? {};
      const revenda = await prisma.revenda.update({
        where: { id: req.params.id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          contactName, email, phone,
        },
      });
      return reply.send(revenda);
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/revendas/:id",
    { preHandler: [requireRole(["admin"])] },
    async (req, reply) => {
      // Remove vínculo dos clientes/usuários antes de deletar
      await prisma.client.updateMany({ where: { revendaId: req.params.id }, data: { revendaId: null } });
      await prisma.user.updateMany({ where: { revendaId: req.params.id }, data: { revendaId: null } });
      await prisma.revenda.delete({ where: { id: req.params.id } });
      return reply.send({ ok: true });
    }
  );
}
