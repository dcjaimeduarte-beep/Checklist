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
  /** tpNF do XML: '0' = Entrada, '1' = Saída (perspectiva do emitente) */
  tpNF?: string;
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
  /** IND_EMIT: '0' = emissão própria, '1' = terceiros */
  indEmit?: string;
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
  /** Filtro de emissão aplicado no confronto */
  filtroEmissao: 'todas' | 'proprias' | 'terceiros';
  /** true se o confronto foi feito filtrando apenas notas de emissão própria */
  apenasProprías: boolean;
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
