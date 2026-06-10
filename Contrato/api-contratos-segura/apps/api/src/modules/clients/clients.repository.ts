import type { ClientStatus, PrismaClient } from "@prisma/client";
import type { CreateClientInput, UpdateClientInput } from "./clients.schemas.js";

export class ClientsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(params: {
    search?: string;
    status?: ClientStatus;
    revendaId?: string;
    skip: number;
    take: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }) {
    // Divide o termo em palavras e exige que TODAS apareçam no nome/CNPJ
    const words = params.search
      ? params.search.trim().split(/\s+/).filter(Boolean)
      : [];

    // SQLite LIKE é nativamente case-insensitive para ASCII — sem mode: insensitive
    const wordOR = (w: string) => ({
      OR: [
        { razaoSocial:  { contains: w } },
        { nomeFantasia: { contains: w } },
        { cnpj:         { contains: w } },
      ],
    });

    const searchCondition = words.length === 0
      ? {}
      : words.length === 1
        ? wordOR(words[0])
        : { AND: words.map(wordOR) };

    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.revendaId !== undefined ? { revendaId: params.revendaId } : {}),
      ...searchCondition,
    };

    const ALLOWED_SORT = ["razaoSocial", "externalCode", "cnpj", "createdAt"] as const;
    const sortBy  = ALLOWED_SORT.includes(params.sortBy as typeof ALLOWED_SORT[number])
      ? (params.sortBy as typeof ALLOWED_SORT[number])
      : "razaoSocial";
    const sortDir = params.sortDir === "desc" ? "desc" : "asc";

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { [sortBy]: sortDir },
        select: {
          id: true,
          externalCode: true,
          razaoSocial: true,
          nomeFantasia: true,
          cnpj: true,
          email: true,
          phone: true,
          contactName: true,
          city: true,
          state: true,
          status: true,
          revendaId: true,
          createdAt: true,
          revenda: { select: { id: true, name: true } },
          _count: { select: { contracts: true } },
        }
      }),
      this.prisma.client.count({ where })
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.client.findUnique({
      where: { id },
      include: {
        contracts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            identifier: true,
            status: true,
            isSigned: true,
            monthlyFee: true,
            startDate: true,
            endDate: true,
            createdAt: true
          }
        }
      }
    });
  }

  async findByCnpj(cnpj: string) {
    return this.prisma.client.findUnique({ where: { cnpj } });
  }

  async create(data: CreateClientInput & { externalCode?: number }) {
    return this.prisma.client.create({ data });
  }

  async update(id: string, data: UpdateClientInput) {
    return this.prisma.client.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ClientStatus) {
    return this.prisma.client.update({ where: { id }, data: { status } });
  }

  async upsertByExternalCode(externalCode: number, data: CreateClientInput) {
    return this.prisma.client.upsert({
      where: { externalCode },
      update: data,
      create: { ...data, externalCode }
    });
  }
}
