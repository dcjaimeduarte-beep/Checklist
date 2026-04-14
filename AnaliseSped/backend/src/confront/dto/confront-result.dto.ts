export class SpedInfoDto {
  cnpj: string;
  nome: string;
  dtIni: string;
  dtFin: string;
  uf: string;
}

export class XmlItemDto {
  chave: string;
  filename: string;
  tipo: string;
  nNF?: string;
  serie?: string;
  dhEmi?: string;
  cnpjEmit?: string;
  xNomeEmit?: string;
  vNF?: string;
  /** Código de status SEFAZ (100=Autorizado, 101=Cancelado, etc.) */
  cStat?: string;
  /** Descrição do status SEFAZ */
  xMotivo?: string;
  /** Data/hora de recebimento pelo SEFAZ */
  dhRecbto?: string;
  /** true se cStat é 100 ou 150 */
  autorizada?: boolean;
}

export class SpedItemDto {
  chave: string;
  registro: string;
  codMod?: string;
  ser?: string;
  numDoc?: string;
  dtDoc?: string;
  codSit?: string;
  indOper?: string;
}

export class ConfrontResultDto {
  sessionId: string;
  createdAt: string;
  spedFilename: string;
  spedInfo: SpedInfoDto;
  totalSpedEntries: number;
  totalXmls: number;
  totalMatches: number;
  xmlsNotInSped: XmlItemDto[];
  spedNotInXml: SpedItemDto[];
  xmlErrors: Array<{ filename: string; reason: string }>;
  /** XMLs que não possuem autorização SEFAZ (sem protocolo ou cStat ≠ 100/150) */
  xmlsSemAutorizacao: XmlItemDto[];
  totalSemAutorizacao: number;
}

export class ConfrontSessionSummaryDto {
  sessionId: string;
  createdAt: string;
  spedFilename: string;
  spedCnpj: string;
  spedNome: string;
  spedDtIni: string;
  spedDtFin: string;
  totalSpedEntries: number;
  totalXmls: number;
  totalMatches: number;
  divergencias: number;
}
