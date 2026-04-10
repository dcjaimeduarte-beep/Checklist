/**
 * Sanitização de entradas para uso em nomes de arquivo/pasta.
 *
 * Permite apenas letras, números, espaços, hífens e underscores.
 * Rejeita qualquer caracter que possa ser usado em path traversal ou
 * injeção de comando (/, \, .., ;, |, $, etc.).
 */

const SAFE_PATTERN = /^[a-zA-Z0-9\u00C0-\u024F\s\-_]+$/;
const MAX_LENGTH = 100;

export class SanitizationError extends Error {
  constructor(field: string) {
    super(`Campo inválido: "${field}" contém caracteres não permitidos.`);
    this.name = 'SanitizationError';
  }
}

/**
 * Normaliza e valida um nome de cliente para uso seguro em caminhos.
 * Retorna o nome normalizado (trim + colapso de espaços múltiplos).
 */
export function sanitizeClientName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');

  if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
    throw new SanitizationError('clientName');
  }

  if (!SAFE_PATTERN.test(trimmed)) {
    throw new SanitizationError('clientName');
  }

  return trimmed;
}

/**
 * Valida formato YYYY-MM para pasta mensal.
 */
export function sanitizeYearMonth(raw: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new SanitizationError('month');
  }
  return raw;
}
