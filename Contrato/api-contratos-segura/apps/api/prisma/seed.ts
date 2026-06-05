import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { env } from "../src/env.js";
import { hashPassword } from "../src/utils/password.js";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);

  await prisma.user.upsert({
    where: {
      email: env.SEED_ADMIN_EMAIL.toLowerCase()
    },
    update: {
      name: env.SEED_ADMIN_NAME,
      role: env.SEED_ADMIN_ROLE as UserRole,
      status: UserStatus.active,
      passwordHash
    },
    create: {
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: env.SEED_ADMIN_ROLE as UserRole,
      status: UserStatus.active
    }
  });

  console.log("Seed concluído com sucesso.");
}

main()
  .catch((error) => {
    console.error("Erro no seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
