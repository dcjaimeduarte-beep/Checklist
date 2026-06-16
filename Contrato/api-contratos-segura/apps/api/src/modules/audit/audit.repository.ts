import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditLogInput } from "./audit.types.js";

export class AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: AuditLogInput) {
    // Valida se o actorUserId existe antes de criar o log — evita FK violation com tokens expirados/resetados
    let actorUserId = data.actorUserId ?? null;
    if (actorUserId) {
      const userExists = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { id: true } });
      if (!userExists) actorUserId = null;
    }

    return this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}
