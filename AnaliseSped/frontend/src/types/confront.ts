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
