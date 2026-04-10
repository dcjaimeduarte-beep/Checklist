/**
 * Autenticação via header x-api-key.
 *
 * Usa timingSafeEqual para evitar timing attacks — comparação com ===
 * permite inferir a chave medindo o tempo de resposta.
 */
import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import { env } from "../config/env";
import { logWarn } from "../utils/logger";

export function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fornecida = req.headers["x-api-key"];

  if (typeof fornecida !== "string" || fornecida.length === 0) {
    res.status(401).json({ erro: "Acesso não autorizado." });
    return;
  }

  const esperada  = Buffer.from(env.apiKey, "utf8");
  const recebida  = Buffer.from(fornecida, "utf8");

  const valida =
    esperada.length === recebida.length &&
    crypto.timingSafeEqual(esperada, recebida);

  if (!valida) {
    logWarn("API key inválida", { ip: req.ip, path: req.path });
    res.status(401).json({ erro: "Acesso não autorizado." });
    return;
  }

  next();
}
