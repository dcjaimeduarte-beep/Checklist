import type { PrismaClient } from "@prisma/client";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async findByEmailOrName(login: string) {
    // Tenta primeiro por e-mail (exato)
    const byEmail = await this.prisma.user.findUnique({
      where: { email: login.toLowerCase() }
    });
    if (byEmail) return byEmail;

    // SQLite LIKE é case-insensitive para ASCII — contains funciona bem aqui
    const byName = await this.prisma.user.findMany({
      where: { name: { contains: login } },
      take: 1,
    });
    return byName[0] ?? null;
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date()
      }
    });
  }
}
