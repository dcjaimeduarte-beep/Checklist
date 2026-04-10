/**
 * Cria caminhos de arquivo de forma segura, impedindo path traversal.
 *
 * CORREÇÃO em relação ao original:
 *   startsWith(resolvedBase) → startsWith(resolvedBase + path.sep)
 *   Sem o separador, "/storage/clientesEvil" passaria na verificação
 *   porque começa com "/storage/clientes".
 */
import path from "node:path";

export class ErroAcessoInvalido extends Error {
  constructor() {
    super("Tentativa de acesso inválido ao diretório.");
    this.name = "ErroAcessoInvalido";
  }
}

export function criarCaminhoSeguro(baseDir: string, ...segments: string[]): string {
  const resolvedBase   = path.resolve(baseDir);
  const resolvedTarget = path.resolve(baseDir, ...segments);

  const dentroBase =
    resolvedTarget === resolvedBase ||
    resolvedTarget.startsWith(resolvedBase + path.sep);

  if (!dentroBase) {
    throw new ErroAcessoInvalido();
  }

  return resolvedTarget;
}
