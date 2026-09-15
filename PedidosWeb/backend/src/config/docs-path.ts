import { isAbsolute, resolve } from 'node:path';

/**
 * Pasta `docs/` na raiz do monorepo (PDF LC 214, planilhas NCM e cClassTrib).
 * `DOCS_PATH` pode ser absoluto ou relativo ao cwd do processo (`backend/`).
 */
export function getDocsPath(): string {
  const raw = process.env.DOCS_PATH;
  if (raw) {
    return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  }
  return resolve(process.cwd(), '..', 'docs');
}
