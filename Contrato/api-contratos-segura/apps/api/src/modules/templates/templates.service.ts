import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import type { CreateTemplateInput, UpdateTemplateInput } from "./templates.schemas.js";

export class TemplatesService {
  constructor(private readonly app: FastifyInstance) {}

  async list() {
    return prisma.contractTemplate.findMany({ orderBy: { createdAt: "desc" } });
  }

  async getDefault() {
    return prisma.contractTemplate.findFirst({ where: { isDefault: true } });
  }

  async getById(id: string) {
    const t = await prisma.contractTemplate.findUnique({ where: { id } });
    if (!t) throw this.app.httpErrors.notFound("Template não encontrado.");
    return t;
  }

  async create(data: CreateTemplateInput) {
    if (data.isDefault) {
      await prisma.contractTemplate.updateMany({ data: { isDefault: false } });
    }
    return prisma.contractTemplate.create({ data });
  }

  async update(id: string, data: UpdateTemplateInput) {
    await this.getById(id);
    if (data.isDefault) {
      await prisma.contractTemplate.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    }
    return prisma.contractTemplate.update({ where: { id }, data });
  }

  async setDefault(id: string) {
    await this.getById(id);
    await prisma.contractTemplate.updateMany({ data: { isDefault: false } });
    return prisma.contractTemplate.update({ where: { id }, data: { isDefault: true } });
  }
}
