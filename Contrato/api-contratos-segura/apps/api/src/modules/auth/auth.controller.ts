import type { FastifyReply, FastifyRequest } from "fastify";
import { loginBodySchema, registerBodySchema, forgotPasswordBodySchema, resetPasswordBodySchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await this.authService.login(body);
    return reply.status(200).send(result);
  };

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = registerBodySchema.parse(request.body);
    const result = await this.authService.register(body);
    return reply.status(201).send(result);
  };

  forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = forgotPasswordBodySchema.parse(request.body);
    await this.authService.forgotPassword(body);
    // Sempre retorna 200 para não revelar se o e-mail existe
    return reply.status(200).send({ message: "Se este e-mail estiver cadastrado, você receberá as instruções em breve." });
  };

  resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = resetPasswordBodySchema.parse(request.body);
    await this.authService.resetPassword(body);
    return reply.status(200).send({ message: "Senha redefinida com sucesso." });
  };
}
