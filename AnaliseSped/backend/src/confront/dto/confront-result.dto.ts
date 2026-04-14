export class CfopSummaryDto {
  cfop: string;
  cstIcms: string;
  aliqIcms: number;
  vlBcIcms: number;
  vlIcms: number;
  vlBcIcmsSt: number;
  vlIcmsSt: number;
  vlOpr: number;
}

export class DashboardDto {
  /** Valor total dos documentos no SPED (VL_DOC) */
  totalVlSpedGeral: number;
  totalVlSpedEntradas: number;
  totalVlSpedSaidas: number;
  /** Valor total dos XMLs enviados (vNF) */
  totalVlXmlGeral: number;
  totalVlXmlEntradas: number;
  totalVlXmlSaidas: number;
  /** Resumo por CFOP do C190 */
  cfopSummary: CfopSummaryDto[];
}

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
  /** VL_DOC do registro C100/D100 */
  vlDoc?: number;
}

export class AuditItemDto {
  chave: string;
  registro: string;
  numDoc?: string;
  dtDoc?: string;
  indOper?: string;
  nNF?: string;
  dhEmi?: string;
  cnpjEmit?: string;
  xNomeEmit?: string;
  vlSped: number;
  vlXml: number;
  diferenca: number;
}

export class AuditReportDto {
  totalSpedCount: number;
  totalXmlCount: number;
  matchedCount: number;
  /** Totais gerais de cada lado (todos os documentos) */
  totalSpedValue: number;
  totalXmlValue: number;
  totalValueDiff: number;
  /** Totais apenas dos pares casados (chave encontrada nos dois lados) */
  totalVlSpedMatched: number;
  totalVlXmlMatched: number;
  /** Soma dos XMLs sem escrituração no SPED */
  totalVlXmlNotInSped: number;
  /** Soma das entradas SPED sem XML correspondente */
  totalVlSpedNotInXml: number;
  /** Documentos presentes em ambos mas com VL_DOC ≠ vNF */
  matchedWithValueDiff: AuditItemDto[];
  /** 'ok' | 'atencao' | 'divergencia' */
  verdict: string;
  verdictMessages: string[];
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
  /** Totais e resumo por CFOP para o dashboard */
  dashboard: DashboardDto;
  /** Relatório de auditoria fiscal */
  audit: AuditReportDto;
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
