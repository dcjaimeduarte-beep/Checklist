/**
 * Handler global de erros — mapeia tipos conhecidos para HTTP correto.
 * Nunca expõe stack trace em produção.
 */
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ErroAcessoInvalido } from "../utils/path.util";
import { logError } from "../utils/logger";
import { env } from "../config/env";

export class ErroClienteNaoEncontrado extends Error {
  constructor(id: number | string) {
    super(`Cliente não encontrado: ${id}`);
    this.name = "ErroClienteNaoEncontrado";
  }
}

export class ErroSemEmail extends Error {
  constructor() {
    super("Cliente sem e-mail cadastrado. Cadastre ao menos um e-mail antes de enviar.");
    this.name = "ErroSemEmail";
  }
}

export class ErroArquivosNaoEncontrados extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ErroArquivosNaoEncontrados";
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ erro: "Dados inválidos", detalhes: err.flatten() });
    return;
  }

  if (err instanceof ErroAcessoInvalido) {
    res.status(400).json({ erro: "Parâmetros inválidos." });
    return;
  }

  if (err instanceof ErroClienteNaoEncontrado) {
    res.status(404).json({ erro: err.message });
    return;
  }

  if (err instanceof ErroSemEmail) {
    res.status(422).json({ erro: err.message });
    return;
  }

  if (err instanceof ErroArquivosNaoEncontrados) {
    res.status(404).json({ erro: err.message });
    return;
  }

  logError("Erro interno", err.message);

  res.status(500).json({
    erro: env.nodeEnv === "production"
      ? "Erro interno do servidor."
      : err.message,
  });
}
