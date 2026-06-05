import type { FastifyInstance } from "fastify";
import { env } from "../../env.js";
import { prisma } from "../../lib/prisma.js";
import { verifyPassword } from "../../utils/password.js";
import type { LoginBody } from "./auth.schemas.js";
import { UserRepository } from "../users/user.repository.js";

export class AuthService {
  private readonly userRepository = new UserRepository(prisma);

  constructor(private readonly app: FastifyInstance) {}

  async login(payload: LoginBody) {
    const user = await this.userRepository.findByEmail(payload.email);

    if (!user) {
      throw this.app.httpErrors.unauthorized("Credenciais inválidas.");
    }

    if (user.status !== "active") {
      throw this.app.httpErrors.forbidden("Usuário inativo.");
    }

    const passwordIsValid = await verifyPassword(user.passwordHash, payload.password);
    if (!passwordIsValid) {
      throw this.app.httpErrors.unauthorized("Credenciais inválidas.");
    }

    await this.userRepository.updateLastLogin(user.id);

    const accessToken = await this.app.jwt.sign(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN
      }
    );

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    };
  }
}
