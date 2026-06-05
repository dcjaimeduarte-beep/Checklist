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

  const role = env.DEV_ADMIN_ROLE as UserRole;

  cachedUser = {
    id: "dev-admin-1",
    name: env.DEV_ADMIN_NAME,
    email: env.DEV_ADMIN_EMAIL,
    role,
    passwordHash: await hashPassword(env.DEV_ADMIN_PASSWORD)
  };

  return cachedUser;
}
