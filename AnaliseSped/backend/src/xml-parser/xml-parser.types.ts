export type XmlDocType = 'NFe' | 'NFC-e' | 'CTe' | 'unknown';

export interface XmlEntry {
  chave: string;
  filename: string;
  tipo: XmlDocType;
  nNF?: string;
  serie?: string;
  dhEmi?: string;
  cnpjEmit?: string;
  xNomeEmit?: string;
  vNF?: string;
}

export interface XmlParseError {
  filename: string;
  reason: string;
}

export interface XmlParseResult {
  entries: XmlEntry[];
  errors: XmlParseError[];
}
