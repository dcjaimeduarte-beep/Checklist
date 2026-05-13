/**
 * Envio com arquivos vindos do navegador (upload).
 * O frontend seleciona a pasta local, lê os arquivos e envia via multipart.
 * O backend busca os e-mails no banco e despacha os anexos.
 */
import { Request, Response } from "express";
import { enviarEmailComAnexos } from "../services/email.service";
import { buscarClientePorId, registrarEnvio, foiEnviado } from "../services/cliente.service";
import { ErroClienteNaoEncontrado, ErroSemEmail } from "../middlewares/error.middleware";
import { logInfo } from "../utils/logger";
import { gerarAssunto, gerarCorpo } from "../config/email.template";

export interface MapeamentoItem {
  clienteId: number;
  arquivos: string[]; // nomes dos arquivos que pertencem a este cliente
}

type Resultado = {
  clienteId: number;
  nome: string;
  status: "ok" | "erro";
  arquivos?: number;
  destinatarios?: string[];
  mensagem?: string;
};

type Anexo = { filename: string; path: string; content: Buffer };

interface ItemValidado {
  clienteId: number;
  nome: string;
  emails: string[];
  anexos: Anexo[];
}

export async function enviarLoteUpload(req: Request, res: Response): Promise<void> {
  const mes: string   = req.body.mes ?? "";
  const mapeamentoRaw = req.body.mapeamento ?? "[]";
  const files         = (req.files as Express.Multer.File[]) ?? [];
  const forceResend   = req.body.forceResend === "true" || req.body.forceResend === true;

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

  // Busboy/multer lê nomes de arquivo como Latin-1 (latin1Slice). Para cobrir
  // nomes com acentos enviados em UTF-8 pelo browser, indexamos sob os dois nomes.
  const fileMap = new Map<string, Express.Multer.File>();
  for (const f of files) {
    fileMap.set(f.originalname, f);
    const utf8name = Buffer.from(f.originalname, "latin1").toString("utf8");
    if (utf8name !== f.originalname) fileMap.set(utf8name, f);
  }

  const resultados: Resultado[] = [];

  // ── Fase 1: validar cada item e preparar anexos ───────────────────────────
  const itensValidados: ItemValidado[] = [];

  for (const item of mapeamento) {
    let nomeCliente = `ID ${item.clienteId}`;
    try {
      const cliente = buscarClientePorId(item.clienteId);
      nomeCliente = cliente.nome;

      if (!forceResend && foiEnviado(item.clienteId, mes)) {
        resultados.push({ clienteId: item.clienteId, nome: cliente.nome, status: "erro", mensagem: "Já enviado neste mês. Marque 'Forçar reenvio' para reenviar." });
        continue;
      }

      if (cliente.emails.length === 0) throw new ErroSemEmail();

      const anexos: Anexo[] = item.arquivos
        .map(nome => ({ nome, file: fileMap.get(nome) }))
        .filter((a): a is { nome: string; file: Express.Multer.File } => !!a.file)
        .map(a => ({ filename: a.nome, path: "", content: a.file.buffer }));

      if (anexos.length === 0) {
        const msg = "Nenhum arquivo encontrado para envio.";
        try { registrarEnvio(item.clienteId, mes, 0, "error", msg); } catch { /* ignora */ }
        resultados.push({ clienteId: item.clienteId, nome: cliente.nome, status: "erro", mensagem: msg });
        continue;
      }

      itensValidados.push({ clienteId: item.clienteId, nome: cliente.nome, emails: cliente.emails, anexos });

    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      if (!(err instanceof ErroClienteNaoEncontrado)) {
        try { registrarEnvio(item.clienteId, mes, 0, "error", mensagem); } catch { /* ignora */ }
      }
      resultados.push({ clienteId: item.clienteId, nome: nomeCliente, status: "erro", mensagem });
    }
  }

  // ── Fase 2: agrupar por destinatário e enviar um único e-mail por grupo ───
  // Clientes com o mesmo conjunto de e-mails recebem um único e-mail consolidado.
  const emailGroups = new Map<string, ItemValidado[]>();
  for (const item of itensValidados) {
    const key = [...item.emails].sort().join("|");
    if (!emailGroups.has(key)) emailGroups.set(key, []);
    emailGroups.get(key)!.push(item);
  }

  for (const group of emailGroups.values()) {
    const principal      = group[0];
    const combinedAnexos = group.flatMap(i => i.anexos);

    try {
      await enviarEmailComAnexos({
        para:    principal.emails,
        assunto: gerarAssunto(principal.nome, mes),
        texto:   gerarCorpo(principal.nome, mes),
        anexos:  combinedAnexos,
      });

      for (const item of group) {
        registrarEnvio(item.clienteId, mes, item.anexos.length, "success", undefined, item.anexos.map(a => a.filename), item.emails);
        logInfo("Upload/envio OK", { clienteId: item.clienteId, nome: item.nome, arquivos: item.anexos.length });
        resultados.push({
          clienteId:     item.clienteId,
          nome:          item.nome,
          status:        "ok",
          arquivos:      item.anexos.length,
          destinatarios: item.emails,
        });
      }
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      for (const item of group) {
        try { registrarEnvio(item.clienteId, mes, 0, "error", mensagem); } catch { /* ignora */ }
        resultados.push({ clienteId: item.clienteId, nome: item.nome, status: "erro", mensagem });
      }
    }
  }

  const enviados = resultados.filter(r => r.status === "ok").length;
  const erros    = resultados.filter(r => r.status === "erro").length;

  res.json({ mes, total: mapeamento.length, enviados, erros, resultados });
}
