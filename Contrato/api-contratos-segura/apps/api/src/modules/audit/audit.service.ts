import { prisma } from "../../lib/prisma.js";
import { AuditRepository } from "./audit.repository.js";
import type { AuditLogInput } from "./audit.types.js";

export class AuditService {
  private readonly auditRepository = new AuditRepository(prisma);

  async log(data: AuditLogInput) {
    return this.auditRepository.create(data);
  }
}
