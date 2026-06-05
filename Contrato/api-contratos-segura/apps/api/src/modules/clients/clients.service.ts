import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { AuditService } from "../audit/audit.service.js";
import type { CreateClientInput, ListClientsQuery, UpdateClientInput } from "./clients.schemas.js";
import { ClientsRepository } from "./clients.repository.js";

export class ClientsService {
  private readonly clientsRepository = new ClientsRepository(prisma);
  private readonly auditService = new AuditService();

  constructor(private readonly app: FastifyInstance) {}

  async list(query: ListClientsQuery) {
    const skip = (query.page - 1) * query.limit;
    const { data, total } = await this.clientsRepository.findAll({
      search:  query.search,
      status:  query.status as "active" | "inactive" | undefined,
      skip,
      take:    query.limit,
      sortBy:  query.sortBy,
      sortDir: query.sortDir,
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
    const client = await this.clientsRepository.findById(id);
    if (!client) throw this.app.httpErrors.notFound("Cliente não encontrado.");
    return client;
  }

  async create(actorUserId: string | undefined, data: CreateClientInput) {
    if (data.cnpj) {
      const existing = await this.clientsRepository.findByCnpj(data.cnpj);
      if (existing) throw this.app.httpErrors.conflict("Já existe um cliente com este CNPJ.");
    }

    const client = await this.clientsRepository.create(data);

    await this.auditService.log({
      actorUserId,
      action: "client.created",
      entityType: "client",
      entityId: client.id,
      metadata: { razaoSocial: client.razaoSocial, cnpj: client.cnpj }
    });

    return client;
  }

  async update(actorUserId: string | undefined, id: string, data: UpdateClientInput) {
    await this.getById(id);
    const updated = await this.clientsRepository.update(id, data);

    await this.auditService.log({
      actorUserId,
      action: "client.updated",
      entityType: "client",
      entityId: id,
      metadata: { fields: Object.keys(data) }
    });

    return updated;
  }

  async updateStatus(actorUserId: string | undefined, id: string, status: "active" | "inactive") {
    await this.getById(id);
    const updated = await this.clientsRepository.updateStatus(id, status);

    await this.auditService.log({
      actorUserId,
      action: "client.status.updated",
      entityType: "client",
      entityId: id,
      metadata: { status }
    });

    return updated;
  }
}
