import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);
  const authController = new AuthController(authService);

  app.post("/auth/login",           authController.login);
  app.post("/auth/register",        authController.register);
  app.post("/auth/forgot-password", authController.forgotPassword);
  app.post("/auth/reset-password",  authController.resetPassword);
}
