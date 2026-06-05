import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { AuditService } from "../audit/audit.service.js";
import type { CreateContractInput, ListContractsQuery, UpdateContractInput } from "./contracts.schemas.js";
import { ContractsRepository } from "./contracts.repository.js";

export class ContractsService {
  private readonly contractsRepository = new ContractsRepository(prisma);
  private readonly auditService = new AuditService();

  constructor(private readonly app: FastifyInstance) {}

  async list(query: ListContractsQuery) {
    const skip = (query.page - 1) * query.limit;
    const { data, total } = await this.contractsRepository.findAll({
      clientId: query.clientId,
      status: query.status as any,
      isSigned: query.isSigned,
      skip,
      take: query.limit
    });

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  }

  async getById(id: string) {
    const contract = await this.contractsRepository.findById(id);
    if (!contract) throw this.app.httpErrors.notFound("Contrato não encontrado.");
    return contract;
  }

  async create(actorUserId: string | undefined, data: CreateContractInput) {
    const contract = await this.contractsRepository.create(data);

    await this.auditService.log({
      actorUserId,
      action: "contract.created",
      entityType: "contract",
      entityId: contract.id,
      metadata: { clientId: contract.clientId, identifier: contract.identifier }
    });

    return contract;
  }

  async update(actorUserId: string | undefined, id: string, data: UpdateContractInput) {
    await this.getById(id);
    const updated = await this.contractsRepository.update(id, data);

    await this.auditService.log({
      actorUserId,
      action: "contract.updated",
      entityType: "contract",
      entityId: id,
      metadata: { fields: Object.keys(data) }
    });

    return updated;
  }

  async sign(actorUserId: string | undefined, id: string, signedAt?: string) {
    const contract = await this.getById(id);

    if (contract.isSigned) {
      throw this.app.httpErrors.conflict("Contrato já está assinado.");
    }

    const date = signedAt ? new Date(signedAt) : new Date();
    const signed = await this.contractsRepository.sign(id, date);

    await this.auditService.log({
      actorUserId,
      action: "contract.signed",
      entityType: "contract",
      entityId: id,
      metadata: { signedAt: date.toISOString() }
    });

    return signed;
  }

  async updateStatus(actorUserId: string | undefined, id: string, status: string) {
    await this.getById(id);
    const updated = await this.contractsRepository.updateStatus(id, status as any);

    await this.auditService.log({
      actorUserId,
      action: "contract.status.updated",
      entityType: "contract",
      entityId: id,
      metadata: { status }
    });

    return updated;
  }

  async delete(actorUserId: string | undefined, id: string) {
    await this.getById(id);
    await this.contractsRepository.delete(id);
    await this.auditService.log({
      actorUserId,
      action: "contract.deleted",
      entityType: "contract",
      entityId: id,
      metadata: {},
    });
  }

  async generateSignLink(actorUserId: string | undefined, id: string, baseUrl: string) {
    const contract = await this.getById(id);

    // Reutiliza token ainda válido (mais de 1h de margem restante)
    const margin = 60 * 60 * 1000;
    if (
      contract.signToken &&
      contract.signTokenExpiresAt &&
      contract.signTokenExpiresAt.getTime() - Date.now() > margin
    ) {
      return {
        url:       `${baseUrl}/sign/${contract.signToken}`,
        expiresAt: contract.signTokenExpiresAt,
        reused:    true,
      };
    }

    const token     = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    await this.contractsRepository.setSignToken(id, token, expiresAt);
    await this.auditService.log({
      actorUserId,
      action: "contract.sign_link_generated",
      entityType: "contract",
      entityId: id,
      metadata: { expiresAt: expiresAt.toISOString() },
    });
    return { url: `${baseUrl}/sign/${token}`, expiresAt, reused: false };
  }

  async getBySignToken(token: string) {
    const contract = await this.contractsRepository.findBySignToken(token);
    if (!contract) throw this.app.httpErrors.notFound("Link inválido ou expirado.");
    if (contract.signTokenExpiresAt && contract.signTokenExpiresAt < new Date()) {
      throw this.app.httpErrors.gone("Este link de assinatura expirou.");
    }
    if (contract.isSigned) throw this.app.httpErrors.conflict("Contrato já assinado.");
    return contract;
  }

  async signViaToken(token: string, signerName: string, signerIp: string, role: "contratante" | "contratada" = "contratante") {
    const contract = await this.getBySignToken(token);

    if (role === "contratante" && contract.signedByNameContratante) {
      throw this.app.httpErrors.conflict("O lado Contratante já assinou este contrato.");
    }
    if (role === "contratada" && contract.signedByName) {
      throw this.app.httpErrors.conflict("O lado Empresa já assinou este contrato.");
    }

    const signed   = await this.contractsRepository.signViaToken(contract.id, signerName, signerIp, role);
    await this.auditService.log({
      actorUserId: undefined,
      action: "contract.signed_online",
      entityType: "contract",
      entityId: contract.id,
      metadata: { signerName, signerIp },
    });
    return signed;
  }

  async stats() {
    return this.contractsRepository.countByStatus();
  }
}
