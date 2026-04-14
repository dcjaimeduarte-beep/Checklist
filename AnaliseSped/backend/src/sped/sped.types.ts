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
}

export interface SpedParseResult {
  info: SpedInfo;
  entries: SpedEntry[];
  invalidLines: number;
}

/** Situações do documento que devem ser sinalizadas (não ignoradas) */
export const SPED_SIT_SINALIZAR = new Set(['02', '03', '04', '07']);

/** Situações a ignorar completamente */
export const SPED_SIT_IGNORAR = new Set(['05']);
