import type { FastifyReply, FastifyRequest } from "fastify";
import {
  contractIdParamSchema,
  createContractSchema,
  listContractsQuerySchema,
  signContractSchema,
  updateContractSchema,
  updateContractStatusSchema
} from "./contracts.schemas.js";
import { ContractsService } from "./contracts.service.js";

type RequestUser = { sub: string };

export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listContractsQuerySchema.parse(request.query);
    return reply.status(200).send(await this.contractsService.list(query));
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    return reply.status(200).send(await this.contractsService.getById(id));
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createContractSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    return reply.status(201).send(await this.contractsService.create(actorUserId, body));
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    const body = updateContractSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    return reply.status(200).send(await this.contractsService.update(actorUserId, id, body));
  };

  sign = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    const body = signContractSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    return reply.status(200).send(await this.contractsService.sign(actorUserId, id, body.signedAt));
  };

  updateStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    const { status } = updateContractStatusSchema.parse(request.body);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    return reply.status(200).send(await this.contractsService.updateStatus(actorUserId, id, status));
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    await this.contractsService.delete(actorUserId, id);
    return reply.status(204).send();
  };

  generateSignLink = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = contractIdParamSchema.parse(request.params);
    const actorUserId = (request.user as RequestUser | undefined)?.sub;
    const proto   = (request.headers["x-forwarded-proto"] as string) ?? "http";
    const host    = (request.headers["x-forwarded-host"] as string) ?? request.hostname;
    const baseUrl = `${proto}://${host}`;
    return reply.status(200).send(
      await this.contractsService.generateSignLink(actorUserId, id, baseUrl)
    );
  };

  stats = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send(await this.contractsService.stats());
  };
}
