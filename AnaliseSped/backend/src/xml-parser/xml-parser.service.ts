import { Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import {
  CSTAT_AUTORIZADO,
  XmlDocType,
  XmlEntry,
  XmlParseError,
  XmlParseResult,
} from './xml-parser.types';

@Injectable()
export class XmlParserService {
  private readonly logger = new Logger(XmlParserService.name);

  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
  });

  /**
   * Processa múltiplos buffers de XML NF-e/CT-e/NFC-e.
   */
  parseMany(
    files: Array<{ buffer: Buffer; originalname: string }>,
  ): XmlParseResult {
    const entries: XmlEntry[] = [];
    const errors: XmlParseError[] = [];

    for (const file of files) {
      try {
        const entry = this.parseSingle(file.buffer, file.originalname);
        if (entry) {
          entries.push(entry);
        } else {
          errors.push({ filename: file.originalname, reason: 'Chave não encontrada no XML' });
        }
      } catch (err) {
        this.logger.warn(`Erro ao parsear ${file.originalname}: ${(err as Error).message}`);
        errors.push({ filename: file.originalname, reason: (err as Error).message });
      }
    }

    this.logger.log(`XMLs parseados: ${entries.length} OK, ${errors.length} erros`);
    return { entries, errors };
  }

  parseSingle(buffer: Buffer, filename: string): XmlEntry | null {
    const text = buffer.toString('utf8');
    const doc = this.parser.parse(text) as Record<string, unknown>;

    // --- NF-e (mod 55) com protocolo ---
    if (doc['nfeProc']) {
      return this.extractFromNfeProc(doc['nfeProc'] as Record<string, unknown>, filename);
    }

    // --- NF-e sem protocolo (apenas NFe raiz) ---
    if (doc['NFe']) {
      return this.extractFromNfe(doc['NFe'] as Record<string, unknown>, filename);
    }

    // --- CT-e com protocolo ---
    if (doc['cteProc']) {
      return this.extractFromCteProc(doc['cteProc'] as Record<string, unknown>, filename);
    }

    // --- CT-e sem protocolo ---
    if (doc['CTe']) {
      return this.extractFromCte(doc['CTe'] as Record<string, unknown>, filename);
    }

    // --- NFC-e (mesma estrutura que NFe, mod 65) ---
    if (doc['nfceProc']) {
      return this.extractFromNfeProc(doc['nfceProc'] as Record<string, unknown>, filename, 'NFC-e');
    }

    return null;
  }

  private extractFromNfeProc(
    proc: Record<string, unknown>,
    filename: string,
    tipo: XmlDocType = 'NFe',
  ): XmlEntry | null {
    const prot = proc['protNFe'] as Record<string, unknown> | undefined;
    const infProt = prot?.['infProt'] as Record<string, unknown> | undefined;
    const chaveProto = infProt?.['chNFe'] as string | undefined;
    const cStat = String(infProt?.['cStat'] ?? '').trim();
    const xMotivo = String(infProt?.['xMotivo'] ?? '').trim();
    const dhRecbto = String(infProt?.['dhRecbto'] ?? '').trim();

    const nfe = proc['NFe'] as Record<string, unknown> | undefined;
    const entry = this.extractFromNfe(nfe ?? {}, filename, tipo);

    if (entry) {
      if (chaveProto && chaveProto.length === 44) entry.chave = chaveProto;
      // Sobrescreve com dados reais do protocolo
      if (cStat) {
        entry.cStat = cStat;
        entry.xMotivo = xMotivo || undefined;
        entry.dhRecbto = dhRecbto || undefined;
        entry.autorizada = CSTAT_AUTORIZADO.has(cStat);
      }
    }

    return entry;
  }

  private extractFromNfe(
    nfe: Record<string, unknown>,
    filename: string,
    tipo: XmlDocType = 'NFe',
  ): XmlEntry | null {
    const infNFe = nfe['infNFe'] as Record<string, unknown> | undefined;
    if (!infNFe) return null;

    // Chave pelo atributo Id="NFe{44}"
    const idAttr = (infNFe['@_Id'] as string | undefined) ?? '';
    const chave = idAttr.replace(/^NFe|^nfe/i, '').replace(/\D/g, '');
    if (chave.length !== 44) return null;

    // Detectar se é NFC-e pelo campo mod
    const ide = infNFe['ide'] as Record<string, unknown> | undefined;
    const mod = String(ide?.['mod'] ?? '');
    const tipoFinal: XmlDocType = mod === '65' ? 'NFC-e' : tipo;

    const emit = infNFe['emit'] as Record<string, unknown> | undefined;
    const total = infNFe['total'] as Record<string, unknown> | undefined;
    const icmsTot = total?.['ICMSTot'] as Record<string, unknown> | undefined;

    return {
      chave,
      filename,
      tipo: tipoFinal,
      nNF: String(ide?.['nNF'] ?? ''),
      serie: String(ide?.['serie'] ?? ''),
      dhEmi: String(ide?.['dhEmi'] ?? ide?.['dEmi'] ?? ''),
      cnpjEmit: String(emit?.['CNPJ'] ?? ''),
      xNomeEmit: String(emit?.['xNome'] ?? ''),
      vNF: String(icmsTot?.['vNF'] ?? ''),
      tpNF: ide?.['tpNF'] !== undefined ? String(ide['tpNF']) : undefined,
      autorizada: false,
    };
  }

  private extractFromCteProc(
    proc: Record<string, unknown>,
    filename: string,
  ): XmlEntry | null {
    const prot = proc['protCTe'] as Record<string, unknown> | undefined;
    const infProt = prot?.['infProt'] as Record<string, unknown> | undefined;
    const chaveProto = infProt?.['chCTe'] as string | undefined;
    const cStat = String(infProt?.['cStat'] ?? '').trim();
    const xMotivo = String(infProt?.['xMotivo'] ?? '').trim();
    const dhRecbto = String(infProt?.['dhRecbto'] ?? '').trim();

    const cte = proc['CTe'] as Record<string, unknown> | undefined;
    const entry = this.extractFromCte(cte ?? {}, filename);

    if (entry) {
      if (chaveProto && chaveProto.length === 44) entry.chave = chaveProto;
      if (cStat) {
        entry.cStat = cStat;
        entry.xMotivo = xMotivo || undefined;
        entry.dhRecbto = dhRecbto || undefined;
        entry.autorizada = CSTAT_AUTORIZADO.has(cStat);
      }
    }

    return entry;
  }

  private extractFromCte(
    cte: Record<string, unknown>,
    filename: string,
  ): XmlEntry | null {
    const infCte = cte['infCte'] as Record<string, unknown> | undefined;
    if (!infCte) return null;

    const idAttr = (infCte['@_Id'] as string | undefined) ?? '';
    const chave = idAttr.replace(/^CTe|^cte/i, '').replace(/\D/g, '');
    if (chave.length !== 44) return null;

    const ide = infCte['ide'] as Record<string, unknown> | undefined;
    const emit = infCte['emit'] as Record<string, unknown> | undefined;
    const vPrest = infCte['vPrest'] as Record<string, unknown> | undefined;

    return {
      chave,
      filename,
      tipo: 'CTe',
      nNF: String(ide?.['nCT'] ?? ''),
      serie: String(ide?.['serie'] ?? ''),
      dhEmi: String(ide?.['dhEmi'] ?? ide?.['dEmi'] ?? ''),
      cnpjEmit: String(emit?.['CNPJ'] ?? ''),
      xNomeEmit: String(emit?.['xNome'] ?? ''),
      vNF: String(vPrest?.['vTPrest'] ?? ''),
      // CT-e usa tpCTe: 0=Normal, 1=Complementar, 3=Substituição; não tem tpNF
      // usamos tpNF='1' fixo (CT-e é sempre saída do emitente)
      tpNF: '1',
      autorizada: false,
    };
  }
}
