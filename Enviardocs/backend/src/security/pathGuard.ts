/**
 * CAMADA DE SEGURANÇA CRÍTICA — Path Traversal Prevention
 *
 * Garante que qualquer caminho resolvido esteja DENTRO do diretório base.
 * Nunca confie em partes de caminho vindas do usuário sem passar por aqui.
 *
 * Ataques bloqueados:
 *   - ../../etc/passwd
 *   - %2e%2e%2f  (URL encoding)
 *   - ..\ (Windows)
 *   - Symlinks que apontam para fora da base (requer lstat — não resolvido aqui)
 */
import path from 'path';

export class PathTraversalError extends Error {
  constructor(message = 'Acesso negado: caminho inválido.') {
    super(message);
    this.name = 'PathTraversalError';
  }
}

/**
 * Resolve e valida que `...segments` permanecem dentro de `basePath`.
 * Lança `PathTraversalError` se a tentativa sair do diretório base.
 */
export function safeJoin(basePath: string, ...segments: string[]): string {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, ...segments);

  if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
    throw new PathTraversalError();
  }

  return resolvedTarget;
}
