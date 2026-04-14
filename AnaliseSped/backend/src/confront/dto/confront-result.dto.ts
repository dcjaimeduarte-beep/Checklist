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
