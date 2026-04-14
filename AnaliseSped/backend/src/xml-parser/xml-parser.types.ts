export type XmlDocType = 'NFe' | 'NFC-e' | 'CTe' | 'unknown';

/** Códigos SEFAZ que representam documento autorizado */
export const CSTAT_AUTORIZADO = new Set(['100', '150']);

export interface XmlEntry {
  chave: string;
  filename: string;
  tipo: XmlDocType;
  nNF?: string;
  serie?: string;
  dhEmi?: string;
  cnpjEmit?: string;
  xNomeEmit?: string;
  vNF?: string;
  /** Código de status SEFAZ (ex: "100" = Autorizado, "101" = Cancelado, undefined = sem protocolo) */
  cStat?: string;
  /** Descrição do status SEFAZ */
  xMotivo?: string;
  /** Data/hora do recebimento pelo SEFAZ */
  dhRecbto?: string;
  /** true se cStat é 100 ou 150 */
  autorizada: boolean;
}

export interface XmlParseError {
  filename: string;
  reason: string;
}

export interface XmlParseResult {
  entries: XmlEntry[];
  errors: XmlParseError[];
}
