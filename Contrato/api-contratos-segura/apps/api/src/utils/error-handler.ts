import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(
    (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      const explicitStatus =
        typeof (error as { statusCode?: number }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : undefined;
      const statusCode =
        explicitStatus && explicitStatus >= 400
          ? explicitStatus
          : error.statusCode && error.statusCode >= 400
            ? error.statusCode
            : 500;

      const clientMessage = error.message?.trim() || "Erro desconhecido.";

      if (statusCode >= 500) {
        app.log.error(error);
      } else {
        app.log.warn({ message: clientMessage, statusCode });
      }

      return reply.status(statusCode).send({
        error: statusCode >= 500 ? "Internal Server Error" : error.name || "Request Error",
        message: statusCode >= 500 ? "Ocorreu um erro interno no servidor." : clientMessage,
      });
    }
  );
}
