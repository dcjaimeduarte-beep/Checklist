import type { FastifyInstance } from "fastify";
import { requireRole } from "../../utils/auth-guard.js";
import { prisma } from "../../lib/prisma.js";

const VALID_TYPES = ["SOLUTIO_ERP", "GCONCILIADOR", "SOLUTIO_WEB"] as const;
type ContractTypeKey = typeof VALID_TYPES[number];

const DISPLAY_NAMES: Record<ContractTypeKey, string> = {
  SOLUTIO_ERP:  "Solutio ERP",
  GCONCILIADOR: "Gconciliador",
  SOLUTIO_WEB:  "Solutio WEB",
};

export async function contractTypesRoutes(app: FastifyInstance) {

  // Lista todos os tipos com seus configs
  app.get("/contract-types", { preHandler: [requireRole(["admin", "juridico"])] }, async (_req, reply) => {
    const configs = await prisma.contractTypeConfig.findMany();
    const configMap = Object.fromEntries(configs.map((c) => [c.type, c]));

    const result = VALID_TYPES.map((type) => ({
      type,
      displayName: configMap[type]?.displayName ?? DISPLAY_NAMES[type],
      clauseOverrides: configMap[type]?.clauseOverrides
        ? JSON.parse(configMap[type].clauseOverrides!)
        : {},
      updatedAt: configMap[type]?.updatedAt ?? null,
    }));

    return reply.send(result);
  });

  // Upsert config de um tipo
  app.put<{
    Params: { type: string };
    Body: { displayName?: string; clauseOverrides?: Record<string, string> };
  }>(
    "/contract-types/:type",
    { preHandler: [requireRole(["admin", "juridico"])] },
    async (req, reply) => {
      const type = req.params.type as ContractTypeKey;
      if (!VALID_TYPES.includes(type)) {
        return reply.status(400).send({ message: "Tipo inválido." });
      }

      const { displayName, clauseOverrides } = req.body ?? {};

      const updated = await prisma.contractTypeConfig.upsert({
        where: { type },
        create: {
          type,
          displayName: displayName ?? DISPLAY_NAMES[type],
          clauseOverrides: clauseOverrides ? JSON.stringify(clauseOverrides) : null,
        },
        update: {
          ...(displayName ? { displayName } : {}),
          clauseOverrides: clauseOverrides !== undefined
            ? JSON.stringify(clauseOverrides)
            : undefined,
        },
      });

      return reply.send({
        type: updated.type,
        displayName: updated.displayName,
        clauseOverrides: updated.clauseOverrides ? JSON.parse(updated.clauseOverrides) : {},
        updatedAt: updated.updatedAt,
      });
    }
  );
}
