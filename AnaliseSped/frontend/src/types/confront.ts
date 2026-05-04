export interface SpedInfo {
  cnpj: string
  nome: string
  dtIni: string
  dtFin: string
  uf: string
}

export interface XmlItem {
  chave: string
  filename: string
  tipo: string
  nNF?: string
  serie?: string
  dhEmi?: string
  cnpjEmit?: string
  xNomeEmit?: string
  vNF?: string
  cfops?: string
  vBC?: string
  vICMS?: string
  vBCST?: string
  vST?: string
  vIPI?: string
  vPIS?: string
  vCOFINS?: string
  vDesc?: string
  vFrete?: string
  /** tpNF: '0' = Entrada, '1' = Saída (perspectiva do emitente) */
  tpNF?: string
  /** Código de status SEFAZ (100=Autorizado, 101=Cancelado etc.) */
  cStat?: string
  /** Descrição do status SEFAZ */
  xMotivo?: string
  /** Data/hora de recebimento pelo SEFAZ */
  dhRecbto?: string
  /** true se cStat é 100 ou 150 */
  autorizada?: boolean
}

export interface SpedItem {
  chave: string
  registro: string
  codMod?: string
  ser?: string
  numDoc?: string
  dtDoc?: string
  codSit?: string
  indOper?: string
  /** IND_EMIT: '0' = emissão própria, '1' = terceiros */
  indEmit?: string
  vlDoc?: number
  vlBcIcms?: number
  vlIcms?: number
  vlBcIcmsSt?: number
  vlIcmsSt?: number
  vlIpi?: number
  vlPis?: number
  vlCofins?: number
}

export interface NotaCompleta {
  chave: string
  /** 'pareado' = encontrada em SPED e XML | 'so-xml' = apenas XML | 'so-sped' = apenas SPED */
  status: 'pareado' | 'so-xml' | 'so-sped'
  // XML
  filename?: string
  tipo?: string
  nNF?: string
  serie?: string
  dhEmi?: string
  cnpjEmit?: string
  xNomeEmit?: string
  vNF?: string
  cfopsXml?: string
  tpNF?: string
  cStat?: string
  xMotivo?: string
  autorizada?: boolean
  vBC?: string
  vICMS?: string
  vBCST?: string
  vST?: string
  vIPI?: string
  vPIS?: string
  vCOFINS?: string
  // SPED
  registro?: string
  numDoc?: string
  dtDoc?: string
  codSit?: string
  indOper?: string
  indEmit?: string
  vlDoc?: number
  cfopsSped?: string
  vlBcIcms?: number
  vlIcms?: number
  // Divergências
  temDivergenciaValor?: boolean
  diferenca?: number
  temDivergenciaCfop?: boolean
  cfopsFaltamNoSped?: string[]
  cfopsFaltamNoXml?: string[]
}

export interface CfopDivergenciaItem {
  chave: string
  numDoc?: string
  dtDoc?: string
  nNF?: string
  dhEmi?: string
  xNomeEmit?: string
  /** CFOPs no XML (ex: "5405, 5656") */
  cfopsXml: string
  /** CFOPs no SPED/C190 (ex: "5405") */
  cfopsSped: string
  /** CFOPs presentes no XML mas ausentes no SPED */
  faltamNoSped: string[]
  /** CFOPs presentes no SPED mas ausentes no XML */
  faltamNoXml: string[]
}

export interface ConfrontResultDto {
  sessionId: string
  createdAt: string
  spedFilename: string
  spedInfo: SpedInfo
  totalSpedEntries: number
  totalXmls: number
  totalMatches: number
  xmlsNotInSped: XmlItem[]
  spedNotInXml: SpedItem[]
  xmlErrors: Array<{ filename: string; reason: string }>
  xmlsSemAutorizacao: XmlItem[]
  totalSemAutorizacao: number
  filtroEmissao: 'todas' | 'proprias' | 'terceiros'
  apenasProprías: boolean
  dashboard: DashboardData
  audit: AuditReport
  cancelamentos: CancelamentoItem[]
  totalCancelamentos: number
  cfopDivergencias: CfopDivergenciaItem[]
  totalCfopDivergencias: number
  todasAsNotas: NotaCompleta[]
}

export interface CfopSummary {
  cfop: string
  cstIcms: string
  aliqIcms: number
  vlBcIcms: number
  vlIcms: number
  vlBcIcmsSt: number
  vlIcmsSt: number
  vlOpr: number
}

export interface XmlCfopSummary {
  cfop: string
  vlNF: number
  vlBC: number
  vlICMS: number
  vlST: number
  /** Qtd documentos XML que contêm este CFOP */
  count: number
  vlNFEntradas: number
  vlNFSaidas: number
}

export interface DashboardData {
  totalVlSpedGeral: number
  totalVlSpedEntradas: number
  totalVlSpedSaidas: number
  /** Soma de VL_OPR do C190 — total operacional fiscal (sem frete/seguro/acessórias) */
  totalVlOprC190: number
  totalVlOprC190Entradas: number
  totalVlOprC190Saidas: number
  totalVlXmlGeral: number
  totalVlXmlEntradas: number
  totalVlXmlSaidas: number
  cfopSummary: CfopSummary[]
  /** Resumo XML por CFOP — todos os documentos, não só divergentes */
  xmlCfopSummary: XmlCfopSummary[]
}

export interface AuditItem {
  chave: string
  registro: string
  numDoc?: string
  dtDoc?: string
  indOper?: string
  nNF?: string
  dhEmi?: string
  cnpjEmit?: string
  xNomeEmit?: string
  vlSped: number
  vlXml: number
  diferenca: number
}

export interface AuditReport {
  totalSpedCount: number
  totalXmlCount: number
  matchedCount: number
  totalSpedValue: number
  totalXmlValue: number
  totalValueDiff: number
  totalVlSpedMatched: number
  totalVlXmlMatched: number
  totalVlXmlNotInSped: number
  totalVlSpedNotInXml: number
  matchedWithValueDiff: AuditItem[]
  verdict: 'ok' | 'atencao' | 'divergencia'
  verdictMessages: string[]
}

export interface CancelamentoItem {
  chave: string
  filename: string
  nNF: string
  dhCancelamento?: string
  cStatEvento: string
  xMotivoEvento: string
  xJust?: string
  noSped: boolean
  codSitSped?: string
  vlDocSped?: number
  registroSped?: string
  situacao: 'ok' | 'atencao' | 'info'
}

export interface ConfrontSessionSummary {
  sessionId: string
  createdAt: string
  spedFilename: string
  spedCnpj: string
  spedNome: string
  spedDtIni: string
  spedDtFin: string
  totalSpedEntries: number
  totalXmls: number
  totalMatches: number
  divergencias: number
}
