export interface SpedInfo {
  cnpj: string;
  nome: string;
  dtIni: string;
  dtFin: string;
  uf: string;
}

export interface SpedEntry {
  registro: 'C100' | 'D100';
  chave: string;
  codMod: string;
  ser: string;
  numDoc: string;
  dtDoc: string;
  codSit: string;
  indOper: string;
  /** IND_EMIT: '0' = emissão própria, '1' = terceiros */
  indEmit: string;
  /** Valor total do documento (VL_DOC) */
  vlDoc: number;
  /** CFOPs dos registros C190 filhos deste C100 (comma-separated, ex: "5405, 5656") */
  cfops?: string;
  /** VL_OPR por CFOP acumulado dos C190 filhos */
  cfopVprod?: Record<string, number>;
  /** Base de cálculo do ICMS (VL_BC_ICMS) */
  vlBcIcms: number;
  /** Valor do ICMS (VL_ICMS) */
  vlIcms: number;
  /** Base de cálculo do ICMS ST (VL_BC_ICMS_ST) */
  vlBcIcmsSt: number;
  /** Valor do ICMS ST (VL_ICMS_ST) */
  vlIcmsSt: number;
  /** Valor do IPI (VL_IPI) */
  vlIpi: number;
  /** Valor do PIS (VL_PIS) */
  vlPis: number;
  /** Valor do COFINS (VL_COFINS) */
  vlCofins: number;
}

/** Resumo por CFOP extraído do registro C190 do SPED */
export interface SpedC190 {
  cstIcms: string;
  cfop: string;
  aliqIcms: number;
  vlBcIcms: number;
  vlIcms: number;
  vlBcIcmsSt: number;
  vlIcmsSt: number;
  vlOpr: number;
}

export interface SpedParseResult {
  info: SpedInfo;
  entries: SpedEntry[];
  cfopSummary: SpedC190[];
  invalidLines: number;
}

/** Situações do documento que devem ser sinalizadas (não ignoradas) */
export const SPED_SIT_SINALIZAR = new Set(['02', '03', '04', '07']);

/** Situações a ignorar completamente */
export const SPED_SIT_IGNORAR = new Set(['05']);
