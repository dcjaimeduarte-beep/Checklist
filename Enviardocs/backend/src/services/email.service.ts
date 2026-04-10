import nodemailer from "nodemailer";
import fs from "node:fs";
import { env } from "../config/env";
import { logInfo, logError } from "../utils/logger";

const LIMITE_BYTES = 25 * 1024 * 1024; // 25 MB

const transporter = nodemailer.createTransport({
  host:   env.smtpHost,
  port:   env.smtpPort,
  secure: env.smtpSecure,
  auth:   { user: env.smtpUser, pass: env.smtpPass },
});

export interface AnexoEmail {
  filename: string;
  path?:    string;   // arquivo no servidor
  content?: Buffer;   // buffer em memória (upload do browser)
}

export async function enviarEmailComAnexos(params: {
  para:    string | string[];
  assunto: string;
  texto:   string;
  anexos:  AnexoEmail[];
}): Promise<void> {
  const destinatarios = Array.isArray(params.para) ? params.para : [params.para];

  // Validar tamanho total dos anexos
  let totalBytes = 0;
  for (const anexo of params.anexos) {
    if (anexo.content) {
      totalBytes += anexo.content.length;
    } else if (anexo.path) {
      if (!fs.existsSync(anexo.path)) {
        throw new Error(`Arquivo não encontrado: ${anexo.filename}`);
      }
      totalBytes += fs.statSync(anexo.path).size;
    }
    if (totalBytes > LIMITE_BYTES) {
      throw new Error("Tamanho total dos anexos excede o limite de 25 MB.");
    }
  }

  try {
    const info = await transporter.sendMail({
      from:        env.smtpFrom,
      to:          destinatarios.join(", "),
      subject:     params.assunto,
      text:        params.texto,
      attachments: params.anexos.map(a => ({
        filename: a.filename,
        ...(a.content ? { content: a.content } : { path: a.path }),
      })),
    });

    logInfo("E-mail enviado com sucesso", {
      para: destinatarios,
      messageId: info.messageId,
      anexos: params.anexos.length,
    });
  } catch (err) {
    logError("Falha ao enviar e-mail", {
      para: destinatarios,
      erro: err instanceof Error ? err.message : String(err),
    });
    throw new Error("Falha ao enviar o e-mail. Tente novamente mais tarde.");
  }
}
