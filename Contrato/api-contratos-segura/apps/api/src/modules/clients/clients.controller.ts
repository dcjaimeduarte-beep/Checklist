import type { FastifyReply, FastifyRequest } from "fastify";
import {
  clientIdParamSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema
} from "./clients.schemas.js";
import { ClientsService } from "./clients.service.js";

type RequestUser = { sub: string };

export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listClientsQuerySchema.parse(request.query);
    const result = await this.clientsService.list(query);
    return reply.status(200).send(result);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = clientIdParamSchema.parse(request.params);
    const result = await this.clientsService.getById(id);
    return reply.status(200).send(result);
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createClientSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    const result = await this.clientsService.create(actorUserId, body);
    return reply.status(201).send(result);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = clientIdParamSchema.parse(request.params);
    const body = updateClientSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    const result = await this.clientsService.update(actorUserId, id, body);
    return reply.status(200).send(result);
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = clientIdParamSchema.parse(request.params);
    const { status } = (request.body as { status: "active" | "inactive" });
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    const result = await this.clientsService.updateStatus(actorUserId, id, status);
    return reply.status(200).send(result);
  };
}
