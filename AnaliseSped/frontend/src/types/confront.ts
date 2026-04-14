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
