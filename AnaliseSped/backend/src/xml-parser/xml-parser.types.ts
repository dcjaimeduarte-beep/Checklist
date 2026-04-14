export type XmlDocType = 'NFe' | 'NFC-e' | 'CTe' | 'CancelNFe' | 'unknown';

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
  /** CFOPs dos itens da nota (únicos, separados por vírgula) */
  cfops?: string;
  /** Base de cálculo do ICMS (ICMSTot.vBC) */
  vBC?: string;
  /** Valor do ICMS (ICMSTot.vICMS) */
  vICMS?: string;
  /** Base de cálculo do ICMS ST (ICMSTot.vBCST) */
  vBCST?: string;
  /** Valor do ICMS ST (ICMSTot.vST) */
  vST?: string;
  /** Valor total do IPI (ICMSTot.vIPI) */
  vIPI?: string;
  /** Valor total do PIS (ICMSTot.vPIS) */
  vPIS?: string;
  /** Valor total do COFINS (ICMSTot.vCOFINS) */
  vCOFINS?: string;
  /** Valor total de desconto (ICMSTot.vDesc) */
  vDesc?: string;
  /** Valor total do frete (ICMSTot.vFrete) */
  vFrete?: string;
  /** tpNF do XML: '0' = Entrada, '1' = Saída (perspectiva do emitente) */
  tpNF?: string;
  /** Código de status SEFAZ (ex: "100" = Autorizado, "101" = Cancelado, undefined = sem protocolo) */
  cStat?: string;
  /** Descrição do status SEFAZ */
  xMotivo?: string;
  /** Data/hora do recebimento pelo SEFAZ */
  dhRecbto?: string;
  /** true se cStat é 100 ou 150 */
  autorizada: boolean;
  /** Tipo do evento NF-e (110111 = cancelamento) — presente apenas em CancelNFe */
  tpEvento?: string;
  /** Justificativa do cancelamento (xJust do evento) */
  xJust?: string;
}

export interface XmlParseError {
  filename: string;
  reason: string;
}

export interface XmlParseResult {
  entries: XmlEntry[];
  errors: XmlParseError[];
}
