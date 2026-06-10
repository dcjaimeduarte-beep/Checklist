import type { ContractStatus, PrismaClient } from "@prisma/client";
import type { CreateContractInput, UpdateContractInput } from "./contracts.schemas.js";

export class ContractsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(params: {
    clientId?: string;
    status?: ContractStatus;
    isSigned?: boolean;
    revendaId?: string;
    search?: string;
    skip: number;
    take: number;
  }) {
    const searchTerm = params.search?.trim();

    // Pré-query: clientes que batem com o termo
    let clientIds: string[] = [];
    if (searchTerm) {
      const matched = await this.prisma.client.findMany({
        where: {
          OR: [
            { razaoSocial:  { contains: searchTerm } },
            { nomeFantasia: { contains: searchTerm } },
            { cnpj:         { contains: searchTerm } },
          ],
        },
        select: { id: true },
      });
      clientIds = matched.map((c) => c.id);
    }

    // A UI exibe: identifier ?? id.slice(0,8).toUpperCase()
    // Então buscamos pelo identifier E pelo id (cuid é minúsculo, por isso toLowerCase)
    const searchCondition = searchTerm
      ? {
          OR: [
            { identifier: { contains: searchTerm } },
            { id:         { startsWith: searchTerm.toLowerCase() } },
            ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
          ],
        }
      : {};

    const where = {
      ...(params.clientId ? { clientId: params.clientId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.isSigned !== undefined ? { isSigned: params.isSigned } : {}),
      ...(params.revendaId ? { client: { revendaId: params.revendaId } } : {}),
      ...searchCondition,
    };

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true, razaoSocial: true, nomeFantasia: true, cnpj: true,
              contactName: true,
              revenda: { select: { id: true, name: true } },
            }
          }
        }
      }),
      this.prisma.contract.count({ where })
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        client: true
      }
    });
  }

  async create(data: CreateContractInput) {
    return this.prisma.contract.create({
      data: {
        clientId: data.clientId,
        identifier: data.identifier,
        startDate: new Date(data.startDate),
        durationMonths: data.durationMonths,
        implementationFee: data.implementationFee,
        implementationPayment: data.implementationPayment,
        monthlyFee: data.monthlyFee,
        paymentDayOfMonth: data.paymentDayOfMonth,
        firstPaymentDate: data.firstPaymentDate ? new Date(data.firstPaymentDate) : null,
        adjustmentIndex: data.adjustmentIndex,
        moduleCadastros: data.moduleCadastros,
        moduleFaturamento: data.moduleFaturamento,
        moduleFiscal: data.moduleFiscal,
        distanceFromProviderKm: data.distanceFromProviderKm,
        notes: data.notes,
        implementationNote: data.implementationNote,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contractType: data.contractType as any,
      },
      include: { client: { select: { id: true, razaoSocial: true } } }
    });
  }

  async update(id: string, data: UpdateContractInput) {
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        firstPaymentDate: data.firstPaymentDate ? new Date(data.firstPaymentDate) : undefined
      }
    });
  }

  async sign(id: string, signedAt: Date) {
    return this.prisma.contract.update({
      where: { id },
      data: { isSigned: true, signedAt, status: "active" }
    });
  }

  async resetSignatures(id: string) {
    return this.prisma.contract.update({
      where: { id },
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
  }

  async updateStatus(id: string, status: ContractStatus) {
    return this.prisma.contract.update({
      where: { id },
      data: { status }
    });
  }

  async delete(id: string) {
    return this.prisma.contract.delete({ where: { id } });
  }

  async findBySignToken(token: string) {
    return this.prisma.contract.findUnique({
      where: { signToken: token },
      include: { client: true },
    });
  }

  async setSignToken(id: string, token: string, expiresAt: Date) {
    return this.prisma.contract.update({
      where: { id },
      data: { signToken: token, signTokenExpiresAt: expiresAt },
    });
  }

  async signViaToken(id: string, signerName: string, signerIp: string, role: "contratada" | "contratante") {
    const now = new Date();

    // Verifica se a outra parte já assinou para saber se ambos terminaram
    const current = await this.prisma.contract.findUnique({
      where: { id },
      select: { signedByName: true, signedByNameContratante: true },
    });
    const otherAlreadySigned = role === "contratante"
      ? !!current?.signedByName
      : !!current?.signedByNameContratante;

    const data = role === "contratante"
      ? {
          signedByNameContratante: signerName,
          signedAtContratante:     now,
          signedByIpContratante:   signerIp,
          // Só fecha quando a contratada também já assinou
          ...(otherAlreadySigned ? {
            isSigned: true, signedAt: now,
            status: "active" as const,
            signToken: null, signTokenExpiresAt: null,
          } : {}),
        }
      : {
          signedByName: signerName,
          signedByIp:   signerIp,
          signedAt:     now,
          // Só fecha quando a contratante também já assinou
          ...(otherAlreadySigned ? {
            isSigned: true,
            status: "active" as const,
            signToken: null, signTokenExpiresAt: null,
          } : {}),
        };

    return this.prisma.contract.update({ where: { id }, data });
  }

  async countByStatus() {
    return this.prisma.contract.groupBy({
      by: ["status"],
      _count: { id: true }
    });
  }
}
