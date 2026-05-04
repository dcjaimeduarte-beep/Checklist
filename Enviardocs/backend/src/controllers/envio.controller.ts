import { Request, Response, NextFunction } from "express";
import {
  localizarArquivosDoCliente,
  tentarLocalizarArquivosDoCliente,
  renomearComoEnviado,
  mesAtual,
} from "../services/arquivo.service";
import { enviarEmailComAnexos } from "../services/email.service";
import {
  resolverClienteParaEnvio,
  listarClientes,
  registrarEnvio,
  jaEnviadosNoMes,
} from "../services/cliente.service";
import { logInfo } from "../utils/logger";
import { gerarAssunto, gerarCorpo } from "../config/email.template";

// ── Envio individual ───────────────────────────────────────────────────────

export async function enviarDocumentosCliente(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { clienteId, mes } = req.body as { clienteId: number; mes?: string };

  try {
    const cliente  = resolverClienteParaEnvio(clienteId);
    const nomePasta = cliente.nomePasta || cliente.nome;
    const anexos    = await localizarArquivosDoCliente(nomePasta, mes);

    await enviarEmailComAnexos({
      para:    cliente.emails,
      assunto: gerarAssunto(cliente.nome, mes ?? ""),
      texto:   gerarCorpo(cliente.nome, mes ?? ""),
      anexos,
    });

    registrarEnvio(clienteId, mes ?? "", anexos.length, "success");

    // Renomeia arquivos com _ok após envio bem-sucedido
    for (const anexo of anexos) {
      try { await renomearComoEnviado(anexo.path); } catch { /* ignora */ }
    }

    logInfo("Documentos enviados", {
      clienteId,
      nome:  cliente.nome,
      destinatarios: cliente.emails,
      totalArquivos: anexos.length,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "E-mail enviado com sucesso.",
      cliente: { id: cliente.id, nome: cliente.nome },
      destinatarios: cliente.emails,
      arquivos: anexos.map((a) => a.filename),
    });
  } catch (err) {
    try { registrarEnvio(clienteId, mes ?? "", 0, "error",
      err instanceof Error ? err.message : String(err)); } catch { /* ignora */ }
    next(err);
  }
}

// ── Preview — escaneia a pasta e cruza com todos os clientes ──────────────

export async function previewEnvios(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const mes = (req.query.mes as string) || mesAtual();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    res.status(400).json({ erro: "Formato de mês inválido. Use YYYY-MM." });
    return;
  }

  try {
    const clientes = listarClientes();

    const resultados = await Promise.all(
      clientes.map(async (cliente) => {
        if (cliente.emails.length === 0) {
          return { cliente, arquivos: [], status: "sem_email" as const };
        }
        const nomePasta = cliente.nomePasta || cliente.nome;
        const arquivos  = await tentarLocalizarArquivosDoCliente(nomePasta, mes);
        return {
          cliente,
          arquivos: arquivos.map((a) => a.filename),
          status: arquivos.length > 0 ? ("ok" as const) : ("sem_arquivo" as const),
        };
      }),
    );

    const ok         = resultados.filter((r) => r.status === "ok").length;
    const semArquivo = resultados.filter((r) => r.status === "sem_arquivo").length;
    const semEmail   = resultados.filter((r) => r.status === "sem_email").length;

    res.json({ mes, resumo: { ok, semArquivo, semEmail, total: clientes.length }, resultados });
  } catch (err) {
    next(err);
  }
}

// ── Envio em lote ─────────────────────────────────────────────────────────

export async function enviarLote(
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const { mes, clienteIds } = req.body as { mes: string; clienteIds: number[] };

  if (!Array.isArray(clienteIds) || clienteIds.length === 0) {
    res.status(400).json({ erro: "Informe ao menos um clienteId." });
    return;
  }

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    res.status(400).json({ erro: "Formato de mês inválido. Use YYYY-MM." });
    return;
  }

  const resultados: Array<{
    clienteId: number;
    nome: string;
    status: "ok" | "erro";
    arquivos?: number;
    destinatarios?: string[];
    mensagem?: string;
  }> = [];

  for (const clienteId of clienteIds) {
    try {
      const cliente   = resolverClienteParaEnvio(clienteId);
      const nomePasta = cliente.nomePasta || cliente.nome;
      const anexos    = await localizarArquivosDoCliente(nomePasta, mes);

      await enviarEmailComAnexos({
        para:    cliente.emails,
        assunto: gerarAssunto(cliente.nome, mes),
        texto:   gerarCorpo(cliente.nome, mes),
        anexos,
      });

      registrarEnvio(clienteId, mes, anexos.length, "success");
      logInfo("Envio lote OK", { clienteId, nome: cliente.nome, arquivos: anexos.length });

      // Renomeia arquivos adicionando _ok após envio bem-sucedido
      for (const anexo of anexos) {
        try { await renomearComoEnviado(anexo.path); } catch { /* ignora erro de renomeação */ }
      }

      resultados.push({
        clienteId,
        nome: cliente.nome,
        status: "ok",
        arquivos: anexos.length,
        destinatarios: cliente.emails,
      });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      try { registrarEnvio(clienteId, mes, 0, "error", mensagem); } catch { /* ignora */ }
      resultados.push({ clienteId, nome: String(clienteId), status: "erro", mensagem });
    }
  }

  const enviados = resultados.filter((r) => r.status === "ok").length;
  const erros    = resultados.filter((r) => r.status === "erro").length;

  res.json({ mes, total: clienteIds.length, enviados, erros, resultados });
}

// ── Clientes já enviados no mês ────────────────────────────────────────────

export function buscarJaEnviados(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const mes = (req.query.mes as string) || "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
    res.status(400).json({ erro: "Formato de mês inválido. Use YYYY-MM." });
    return;
  }
  try {
    const clienteIds = jaEnviadosNoMes(mes);
    res.json({ mes, clienteIds });
  } catch (err) {
    next(err);
  }
}
