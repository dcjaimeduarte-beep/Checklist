import type { FastifyReply, FastifyRequest } from "fastify";
import { loginBodySchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = loginBodySchema.parse(request.body);
    const result = await this.authService.login(body);

    return reply.status(200).send(result);
  };
}
