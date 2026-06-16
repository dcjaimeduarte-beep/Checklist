import { env } from "../../env.js";
import { hashPassword } from "../../utils/password.js";
import type { AuthenticatedUser, UserRole } from "./auth.types.js";

type DevUserRecord = AuthenticatedUser & {
  passwordHash: string;
};

let cachedUser: DevUserRecord | null = null;

export async function getDevAdminUser(): Promise<DevUserRecord> {
  if (cachedUser) {
    return cachedUser;
  }

  const role = env.SEED_ADMIN_ROLE as UserRole;

  cachedUser = {
    id: "dev-admin-1",
    name: env.SEED_ADMIN_NAME,
    email: env.SEED_ADMIN_EMAIL,
    role,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD)
  };

  return cachedUser;
}
