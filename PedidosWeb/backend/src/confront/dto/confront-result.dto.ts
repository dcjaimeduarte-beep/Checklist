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

/**
 * Resumo dos XMLs por CFOP — agrega vNF/ICMS/ST de todos os documentos XML
 * cujo campo cfops contenha o CFOP. Para documentos com múltiplos CFOPs,
 * o valor total é contabilizado em cada CFOP presente (aproximação).
 */
export class XmlCfopSummaryDto {
  cfop: string;
  vlNF: number;
  vlBC: number;
  vlICMS: number;
  vlST: number;
  /** Quantidade de documentos XML que contêm este CFOP */
  count: number;
  /** Entradas (tpNF=0) */
  vlNFEntradas: number;
  /** Saídas (tpNF=1) */
  vlNFSaidas: number;
}

export class DashboardDto {
  /** Valor total dos documentos no SPED (soma VL_DOC do C100/D100) */
  totalVlSpedGeral: number;
  totalVlSpedEntradas: number;
  totalVlSpedSaidas: number;
  /**
   * Soma de VL_OPR do C190 — representa o total operacional fiscal do SPED.
   * Exclui frete/seguro/acessórias; é o campo que a contabilidade usa como referência.
   */
  totalVlOprC190: number;
  totalVlOprC190Entradas: number;
  totalVlOprC190Saidas: number;
  /** Valor total dos XMLs enviados (vNF) */
  totalVlXmlGeral: number;
  totalVlXmlEntradas: number;
  totalVlXmlSaidas: number;
  /** Resumo por CFOP do C190 (SPED) */
  cfopSummary: CfopSummaryDto[];
  /** Resumo por CFOP dos XMLs (todos os documentos, não só os divergentes) */
  xmlCfopSummary: XmlCfopSummaryDto[];
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
  cfops?: string;
  vBC?: string;
  vICMS?: string;
  vBCST?: string;
  vST?: string;
  vIPI?: string;
  vPIS?: string;
  vCOFINS?: string;
  vDesc?: string;
  vFrete?: string;
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
  vlDoc?: number;
  vlBcIcms?: number;
  vlIcms?: number;
  vlBcIcmsSt?: number;
  vlIcmsSt?: number;
  vlIpi?: number;
  vlPis?: number;
  vlCofins?: number;
}

/** Evento de cancelamento processado e cruzado com SPED */
export class CancelamentoItemDto {
  /** Chave de acesso da NF-e cancelada */
  chave: string;
  /** Nome do arquivo do evento */
  filename: string;
  /** Número da NF-e (extraído da chave, posição 25-33) */
  nNF: string;
  /** Data/hora de registro do evento no SEFAZ */
  dhCancelamento?: string;
  /** Código de status do evento (135/136 = registrado, outros = erro) */
  cStatEvento: string;
  /** Descrição do status do evento */
  xMotivoEvento: string;
  /** Justificativa do cancelamento informada pelo contribuinte */
  xJust?: string;
  /** Número do protocolo do evento */
  nProt?: string;
  /** true se a chave está escriturada no SPED */
  noSped: boolean;
  /** COD_SIT do registro no SPED (02=Cancelado, etc.) — presente se noSped=true */
  codSitSped?: string;
  /** VL_DOC do registro no SPED — presente se noSped=true */
  vlDocSped?: number;
  /** Registro SPED onde foi encontrado (C100 ou D100) */
  registroSped?: string;
  /**
   * Situação da consolidação:
   * 'ok'        = noSped && codSitSped==='02' (cancelado em ambos)
   * 'atencao'   = noSped && codSitSped!=='02' (ativo no SPED, cancelado no XML)
   * 'info'      = !noSped (não escriturado — normal para cancelamentos)
   */
  situacao: 'ok' | 'atencao' | 'info';
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
  /** Eventos de cancelamento (tpEvento 110111) consolidados com o SPED */
  cancelamentos: CancelamentoItemDto[];
  totalCancelamentos: number;
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
