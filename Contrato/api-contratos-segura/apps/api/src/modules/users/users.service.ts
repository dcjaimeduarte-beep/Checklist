import type { FastifyInstance } from "fastify";
import type { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AuditService } from "../audit/audit.service.js";
import { hashPassword } from "../../utils/password.js";
import type { CreateUserBody, UpdateUserBody } from "./users.schemas.js";
import { UsersRepository } from "./users.repository.js";

export class UsersService {
  private readonly usersRepository = new UsersRepository(prisma);
  private readonly auditService = new AuditService();

  constructor(private readonly app: FastifyInstance) {}

  async listUsers() {
    return this.usersRepository.findAll();
  }

  async getUserById(id: string) {
    const user = await this.usersRepository.findById(id);

    if (!user) {
      throw this.app.httpErrors.notFound("Usuário não encontrado.");
    }

    return user;
  }

  async createUser(
    actorUserId: string | undefined,
    payload: CreateUserBody
  ) {
    const existingUser = await this.usersRepository.findByEmail(payload.email);

    if (existingUser) {
      throw this.app.httpErrors.conflict("Já existe um usuário com este e-mail.");
    }

    const passwordHash = await hashPassword(payload.password);

    const createdUser = await this.usersRepository.create({
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: payload.role as UserRole,
      revendaId: payload.revendaId ?? null,
    });

    await this.auditService.log({
      actorUserId,
      action: "user.created",
      entityType: "user",
      entityId: createdUser.id,
      metadata: {
        createdUserEmail: createdUser.email,
        createdUserRole: createdUser.role,
        createdUserStatus: createdUser.status
      }
    });

    return createdUser;
  }

  async updateUser(actorUserId: string | undefined, id: string, payload: UpdateUserBody) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) throw this.app.httpErrors.notFound("Usuário não encontrado.");

    if (payload.email && payload.email.toLowerCase() !== existing.email) {
      const conflict = await this.usersRepository.findByEmail(payload.email);
      if (conflict) throw this.app.httpErrors.conflict("Já existe um usuário com este e-mail.");
    }

    const data: Parameters<typeof this.usersRepository.update>[1] = {};
    if (payload.name)      data.name  = payload.name.trim();
    if (payload.email)     data.email = payload.email.toLowerCase();
    if (payload.role)      data.role  = payload.role as UserRole;
    if ("revendaId" in payload) data.revendaId = payload.revendaId ?? null;
    if (payload.password)  data.passwordHash = await hashPassword(payload.password);

    const updated = await this.usersRepository.update(id, data);

    await this.auditService.log({
      actorUserId,
      action: "user.updated",
      entityType: "user",
      entityId: id,
      metadata: { fields: Object.keys(data) },
    });

    return updated;
  }

  async updateUserStatus(
    actorUserId: string | undefined,
    id: string,
    status: UserStatus
  ) {
    const existingUser = await this.usersRepository.findById(id);

    if (!existingUser) {
      throw this.app.httpErrors.notFound("Usuário não encontrado.");
    }

    const updatedUser = await this.usersRepository.updateStatus(id, status);

    await this.auditService.log({
      actorUserId,
      action: "user.status.updated",
      entityType: "user",
      entityId: updatedUser.id,
      metadata: {
        previousStatus: existingUser.status,
        newStatus: updatedUser.status,
        targetUserEmail: updatedUser.email
      }
    });

    return updatedUser;
  }
}
