/**
 * Envio com arquivos vindos do navegador (upload).
 * O frontend seleciona a pasta local, lê os arquivos e envia via multipart.
 * O backend busca os e-mails no banco e despacha os anexos.
 */
import { Request, Response } from "express";
import { enviarEmailComAnexos } from "../services/email.service";
import { buscarClientePorId, registrarEnvio } from "../services/cliente.service";
import { ErroClienteNaoEncontrado, ErroSemEmail } from "../middlewares/error.middleware";
import { logInfo } from "../utils/logger";
import { gerarAssunto, gerarCorpo } from "../config/email.template";

export interface MapeamentoItem {
  clienteId: number;
  arquivos: string[]; // nomes dos arquivos que pertencem a este cliente
}

export async function enviarLoteUpload(req: Request, res: Response): Promise<void> {
  const mes: string       = req.body.mes ?? "";
  const mapeamentoRaw     = req.body.mapeamento ?? "[]";
  const files             = (req.files as Express.Multer.File[]) ?? [];

  let mapeamento: MapeamentoItem[];
  try {
    mapeamento = JSON.parse(mapeamentoRaw) as MapeamentoItem[];
  } catch {
    res.status(400).json({ erro: "Campo 'mapeamento' inválido." });
    return;
  }

  if (!mapeamento.length) {
    res.status(400).json({ erro: "Nenhum cliente no mapeamento." });
    return;
  }

  // Indexa os arquivos enviados pelo nome original
  const fileMap = new Map<string, Express.Multer.File>();
  for (const f of files) fileMap.set(f.originalname, f);

  const resultados: Array<{
    clienteId: number;
    nome: string;
    status: "ok" | "erro";
    arquivos?: number;
    destinatarios?: string[];
    mensagem?: string;
  }> = [];

  for (const item of mapeamento) {
    let nomeCliente = `ID ${item.clienteId}`;
    try {
      const cliente = buscarClientePorId(item.clienteId);
      nomeCliente = cliente.nome;

      if (cliente.emails.length === 0) throw new ErroSemEmail();

      // Monta os anexos com o buffer em memória
      const anexos = item.arquivos
        .map(nome => ({ nome, file: fileMap.get(nome) }))
        .filter((a): a is { nome: string; file: Express.Multer.File } => !!a.file)
        .map(a => ({
          filename: a.nome,
          path:     "",          // não usado quando passamos content
          content:  a.file.buffer,
        }));

      if (anexos.length === 0) {
        resultados.push({ clienteId: item.clienteId, nome: cliente.nome, status: "erro", mensagem: "Nenhum arquivo encontrado para envio." });
        continue;
      }

      await enviarEmailComAnexos({
        para:    cliente.emails,
        assunto: gerarAssunto(cliente.nome, mes),
        texto:   gerarCorpo(cliente.nome, mes),
        anexos,
      });

      registrarEnvio(item.clienteId, mes, anexos.length, "success");
      logInfo("Upload/envio OK", { clienteId: item.clienteId, nome: cliente.nome, arquivos: anexos.length });

      resultados.push({
        clienteId:     item.clienteId,
        nome:          cliente.nome,
        status:        "ok",
        arquivos:      anexos.length,
        destinatarios: cliente.emails,
      });

    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      if (!(err instanceof ErroClienteNaoEncontrado)) {
        try { registrarEnvio(item.clienteId, mes, 0, "error", mensagem); } catch { /* ignora */ }
      }
      resultados.push({ clienteId: item.clienteId, nome: nomeCliente, status: "erro", mensagem });
    }
  }

  const enviados = resultados.filter(r => r.status === "ok").length;
  const erros    = resultados.filter(r => r.status === "erro").length;

  res.json({ mes, total: mapeamento.length, enviados, erros, resultados });
}
