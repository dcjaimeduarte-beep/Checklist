import type { FastifyInstance } from "fastify";
import { requireAuth, requireRole } from "../utils/auth-guard.js";

export async function protectedRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [requireAuth]
    },
    async (request) => {
      const user = request.user as {
        sub: string;
        name: string;
        email: string;
        role: string;
      };

      return {
        authenticated: true,
        user
      };
    }
  );

  app.get(
    "/admin-only",
    {
      preHandler: [requireRole(["admin"])]
    },
    async () => {
      return {
        ok: true,
        area: "admin"
      };
    }
  );
}
