import type { FastifyReply, FastifyRequest } from "fastify";
import type { UserRole } from "../modules/auth/auth.types.js";

type JwtUser = { sub: string; role?: UserRole; revendaId?: string | null };

export function getAuthUser(request: FastifyRequest): JwtUser {
  return request.user as JwtUser;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Token inválido ou ausente."
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();

      const userRole = (request.user as JwtUser).role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Você não tem permissão para acessar este recurso."
        });
      }
    } catch {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Token inválido ou ausente."
      });
    }
  };
}
