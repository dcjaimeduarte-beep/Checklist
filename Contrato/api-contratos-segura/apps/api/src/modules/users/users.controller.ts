import type { FastifyReply, FastifyRequest } from "fastify";
import {
  createUserBodySchema,
  getUserByIdParamsSchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
  updateUserStatusParamsSchema
} from "./users.schemas.js";
import { UsersService } from "./users.service.js";

type RequestUser = {
  sub: string;
};

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  list = async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await this.usersService.listUsers();
    return reply.status(200).send(result);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = getUserByIdParamsSchema.parse(request.params);
    const result = await this.usersService.getUserById(params.id);

    return reply.status(200).send(result);
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createUserBodySchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;

    const result = await this.usersService.createUser(actorUserId, body);

    return reply.status(201).send(result);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = getUserByIdParamsSchema.parse(request.params);
    const body = updateUserBodySchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    const result = await this.usersService.updateUser(actorUserId, params.id, body);
    return reply.status(200).send(result);
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = updateUserStatusParamsSchema.parse(request.params);
    const body = updateUserStatusBodySchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;

    const result = await this.usersService.updateUserStatus(
      actorUserId,
      params.id,
      body.status
    );

    return reply.status(200).send(result);
  };
}
