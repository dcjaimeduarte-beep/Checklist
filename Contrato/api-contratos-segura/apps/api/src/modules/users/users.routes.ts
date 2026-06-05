import type { FastifyInstance } from "fastify";
import { requireRole } from "../../utils/auth-guard.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

export async function usersRoutes(app: FastifyInstance) {
  const usersService = new UsersService(app);
  const usersController = new UsersController(usersService);

  app.get(
    "/users",
    {
      preHandler: [requireRole(["admin"])]
    },
    usersController.list
  );

  app.get(
    "/users/:id",
    {
      preHandler: [requireRole(["admin"])]
    },
    usersController.getById
  );

  app.post(
    "/users",
    {
      preHandler: [requireRole(["admin"])]
    },
    usersController.create
  );

  app.patch(
    "/users/:id/status",
    {
      preHandler: [requireRole(["admin"])]
    },
    usersController.updateStatus
  );
}
