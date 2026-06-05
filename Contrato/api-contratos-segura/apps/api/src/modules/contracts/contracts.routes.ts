import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../../utils/auth-guard.js";
import { ContractsController } from "./contracts.controller.js";
import { ContractsService } from "./contracts.service.js";
import { prisma } from "../../lib/prisma.js";
import { mergeTemplate, applyClauseOverrides } from "../../utils/template-merge.js";

export async function contractsRoutes(app: FastifyInstance) {
  const contractsService = new ContractsService(app);
  const contractsController = new ContractsController(contractsService);

  app.get("/contracts/stats", { preHandler: [requireAuth] }, contractsController.stats);
  app.get("/contracts", { preHandler: [requireAuth] }, contractsController.list);
  app.get("/contracts/:id", { preHandler: [requireAuth] }, contractsController.getById);
  app.post("/contracts", { preHandler: [requireRole(["admin", "juridico", "comercial"])] }, contractsController.create);
  app.patch("/contracts/:id", { preHandler: [requireRole(["admin", "juridico"])] }, contractsController.update);
  app.patch("/contracts/:id/sign", { preHandler: [requireRole(["admin", "juridico"])] }, contractsController.sign);
  app.patch("/contracts/:id/status", { preHandler: [requireRole(["admin"])] }, contractsController.updateStatus);
  app.delete("/contracts/:id", { preHandler: [requireRole(["admin"])] }, contractsController.delete);
  app.post("/contracts/:id/sign-link", { preHandler: [requireRole(["admin", "juridico"])] }, contractsController.generateSignLink);

  app.patch<{ Params: { id: string } }>(
    "/contracts/:id/reset-signatures",
    { preHandler: [requireRole(["admin", "juridico"])] },
    async (req, reply) => {
      const contract = await prisma.contract.findUnique({ where: { id: req.params.id } });
      if (!contract) return reply.status(404).send({ message: "Contrato não encontrado." });
      const updated = await prisma.contract.update({
        where: { id: req.params.id },
        data: {
          isSigned: false,
          signedAt: null,
          signedByName: null,
          signedByIp: null,
          signedByNameContratante: null,
          signedAtContratante: null,
          signedByIpContratante: null,
          signToken: null,
          signTokenExpiresAt: null,
          status: "draft",
        },
      });
      return reply.send(updated);
    }
  );

  // ── Assinatura pública (sem autenticação) ─────────────────────────────────
  app.get<{ Params: { token: string } }>("/public/sign/:token", async (req, reply) => {
    const contract = await contractsService.getBySignToken(req.params.token);
    const template = await prisma.contractTemplate.findFirst({ where: { isDefault: true } });
    const typeConfig = template
      ? await prisma.contractTypeConfig.findUnique({ where: { type: contract.contractType } })
      : null;
    const templateContent = template
      ? applyClauseOverrides(template.content, typeConfig?.clauseOverrides)
      : null;
    const content = templateContent ? mergeTemplate(templateContent, { client: contract.client, contract }) : null;
    return reply.send({
      id:                      contract.id,
      identifier:              contract.identifier,
      clientName:              contract.client.razaoSocial,
      clientCnpj:              contract.client.cnpj,
      monthlyFee:              contract.monthlyFee,
      startDate:               contract.startDate,
      content,
      expiresAt:               contract.signTokenExpiresAt,
      signedByName:            contract.signedByName,
      signedByNameContratante: contract.signedByNameContratante,
    });
  });

  app.post<{ Params: { token: string }; Body: { signerName: string; role?: "contratante" | "contratada" } }>(
    "/public/sign/:token",
    async (req, reply) => {
      const { signerName, role } = req.body ?? {};
      if (!signerName?.trim()) {
        return reply.status(400).send({ message: "Nome do assinante é obrigatório." });
      }
      const ip = req.ip ?? "unknown";
      const signed = await contractsService.signViaToken(req.params.token, signerName.trim(), ip, role ?? "contratante");
      return reply.send({
        ok: true,
        signedAt: signed.signedAt,
        signedByName: signed.signedByName,
        fullySignedNow: signed.isSigned,
      });
    }
  );

  // ── Contratos próximos do reajuste anual ──────────────────────────────────
  app.get<{ Querystring: { days?: string } }>("/contracts/due-for-adjustment", { preHandler: [requireAuth] }, async (req, reply) => {
    const days = parseInt(req.query.days ?? "60", 10);
    const now  = new Date();
    const horizon = new Date(now.getTime() + days * 86_400_000);

    // Busca contratos ativos
    const contracts = await prisma.contract.findMany({
      where: { status: "active" },
      include: { client: true },
      orderBy: { startDate: "asc" },
    });

    // Calcula próxima data de reajuste para cada contrato
    const result = contracts
      .map((c) => {
        const base = c.lastAdjustmentDate ?? c.startDate;
        const next = new Date(base);
        next.setFullYear(next.getFullYear() + 1);
        const daysLeft = Math.ceil((next.getTime() - now.getTime()) / 86_400_000);
        return { ...c, nextAdjustmentDate: next.toISOString(), daysLeft };
      })
      .filter((c) => c.nextAdjustmentDate <= horizon.toISOString())
      .sort((a, b) => a.daysLeft - b.daysLeft);

    return reply.send(result);
  });

  // ── Aplicar reajuste ──────────────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: { newMonthlyFee: number; appliedAt?: string } }>(
    "/contracts/:id/apply-adjustment",
    { preHandler: [requireRole(["admin", "juridico"])] },
    async (req, reply) => {
      const { id } = req.params;
      const { newMonthlyFee, appliedAt } = req.body;

      const contract = await prisma.contract.findUnique({ where: { id } });
      if (!contract) return reply.status(404).send({ message: "Contrato não encontrado." });

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          monthlyFee: newMonthlyFee,
          lastAdjustmentDate: appliedAt ? new Date(appliedAt) : new Date(),
        },
        include: { client: true },
      });

      return reply.send(updated);
    }
  );

  // Gerar documento do contrato mesclado com o template padrão
  app.get<{ Params: { id: string } }>("/contracts/:id/document", { preHandler: [requireAuth] }, async (req, reply) => {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: { client: true },
    });
    if (!contract) return reply.status(404).send({ message: "Contrato não encontrado." });

    const template = await prisma.contractTemplate.findFirst({ where: { isDefault: true } });
    if (!template) return reply.status(404).send({ message: "Nenhum template padrão definido. Crie um template em Configurações > Templates." });

    // Aplica overrides de cláusulas do tipo de contrato antes do merge
    const typeConfig = await prisma.contractTypeConfig.findUnique({
      where: { type: contract.contractType },
    });
    const templateWithOverrides = applyClauseOverrides(template.content, typeConfig?.clauseOverrides);

    const content = mergeTemplate(templateWithOverrides, {
      client: contract.client,
      contract,
    });

    return reply.send({ content, contract, client: contract.client, templateName: template.name });
  });
}
