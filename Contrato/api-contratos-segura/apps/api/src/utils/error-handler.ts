import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(
    (error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
      // ZodError de validação de schema — retorna 400 com mensagem legível
      if (error.name === "ZodError") {
        let message = "Dados inválidos.";
        try {
          const issues = JSON.parse(error.message) as { path: string[]; message: string }[];
          message = issues.map((i) => i.message).join(" | ");
        } catch { /* mantém mensagem genérica */ }
        return reply.status(400).send({ error: "Validation Error", message });
      }

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
