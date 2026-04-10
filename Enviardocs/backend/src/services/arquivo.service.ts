/**
 * Localiza os arquivos de um cliente na pasta mensal.
 *
 * Estratégia de busca (em ordem):
 *  1. Subpasta: {storageDir}/{YYYY-MM}/{nomePasta}/
 *  2. Pasta plana: {storageDir}/{YYYY-MM}/ — arquivos cujo nome normalizado
 *     contém o nome normalizado do cliente (mesmo padrão do projeto original)
 *
 * nomePasta = cliente.nomePasta ?? cliente.nome (definido no cadastro)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";
import { normalizarNome } from "../utils/nome.util";
import { criarCaminhoSeguro } from "../utils/path.util";
import { ErroArquivosNaoEncontrados } from "../middlewares/error.middleware";
import { logInfo } from "../utils/logger";

const EXTENSOES_PERMITIDAS = new Set([".pdf", ".xml", ".xlsx", ".docx", ".csv", ".zip"]);

export function mesAtual(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Renomeia arquivo adicionando _ok antes da extensão após envio bem-sucedido */
export async function renomearComoEnviado(filePath: string): Promise<void> {
  const dir  = path.dirname(filePath);
  const ext  = path.extname(filePath);
  const base = path.basename(filePath, ext);
  if (base.endsWith("_ok")) return; // já foi renomeado
  const novoPath = path.join(dir, `${base}_ok${ext}`);
  await fs.rename(filePath, novoPath);
}

/** Versão silenciosa — retorna [] se nada for encontrado */
export async function tentarLocalizarArquivosDoCliente(
  nomePasta: string,
  mes: string,
): Promise<ArquivoLocalizado[]> {
  try {
    return await localizarArquivosDoCliente(nomePasta, mes);
  } catch {
    return [];
  }
}

export interface ArquivoLocalizado {
  filename: string;
  path: string;
}

export async function localizarArquivosDoCliente(
  nomePasta: string,
  mes?: string,
): Promise<ArquivoLocalizado[]> {
  const pastaMes = mes ?? mesAtual();
  const baseDir  = criarCaminhoSeguro(env.storageDir);
  const pastaDoMes = criarCaminhoSeguro(baseDir, pastaMes);

  // Verificar existência da pasta do mês
  try {
    await fs.access(pastaDoMes);
  } catch {
    throw new ErroArquivosNaoEncontrados(
      `Pasta do mês "${pastaMes}" não encontrada em: ${env.storageDir}`,
    );
  }

  // ── Estratégia 1: subpasta dedicada ao cliente ─────────────────────────
  try {
    const subpasta = criarCaminhoSeguro(pastaDoMes, nomePasta);
    const stat = await fs.stat(subpasta);
    if (stat.isDirectory()) {
      const arquivos = await listarArquivosPermitidos(subpasta, pastaDoMes);
      if (arquivos.length > 0) {
        logInfo("Arquivos localizados (subpasta)", { nomePasta, pastaMes, total: arquivos.length });
        return arquivos;
      }
    }
  } catch { /* subpasta não existe, continua */ }

  // ── Estratégia 2: pasta plana com nome normalizado ─────────────────────
  const clienteNormalizado = normalizarNome(nomePasta);
  const todosArquivos = await fs.readdir(pastaDoMes);

  const encontrados = todosArquivos
    .filter((arquivo) => {
      const ext = path.extname(arquivo).toLowerCase();
      if (!EXTENSOES_PERMITIDAS.has(ext)) return false;
      const nomeBase = path.basename(arquivo, ext);
      return normalizarNome(nomeBase).includes(clienteNormalizado);
    })
    .map((arquivo) => ({
      filename: arquivo,
      path: criarCaminhoSeguro(pastaDoMes, arquivo),
    }));

  if (encontrados.length === 0) {
    throw new ErroArquivosNaoEncontrados(
      `Nenhum arquivo encontrado para "${nomePasta}" em "${pastaMes}". ` +
      `Verifique se o campo "nomePasta" do cliente corresponde ao nome do arquivo.`,
    );
  }

  logInfo("Arquivos localizados (pasta plana)", {
    nomePasta,
    pastaMes,
    total: encontrados.length,
    arquivos: encontrados.map((a) => a.filename),
  });

  return encontrados;
}

async function listarArquivosPermitidos(
  dir: string,
  baseParaSeguranca: string,
): Promise<ArquivoLocalizado[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && EXTENSOES_PERMITIDAS.has(path.extname(e.name).toLowerCase()))
    .map((e) => ({
      filename: e.name,
      path: criarCaminhoSeguro(baseParaSeguranca, dir.split(path.sep).pop()!, e.name),
    }));
}
