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

    // --- Evento de cancelamento NF-e (tpEvento 110111) ---
    if (doc['procEventoNFe']) {
      return this.extractFromEventoNFe(doc['procEventoNFe'] as Record<string, unknown>, filename);
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

    const emit    = infNFe['emit']  as Record<string, unknown> | undefined;
    const total   = infNFe['total'] as Record<string, unknown> | undefined;
    const icmsTot = total?.['ICMSTot'] as Record<string, unknown> | undefined;

    // CFOPs únicos dos itens da nota + soma de vProd por CFOP
    const det = infNFe['det'];
    const detArr: Record<string, unknown>[] = Array.isArray(det) ? det : det ? [det as Record<string, unknown>] : [];
    const cfopSet = new Set<string>();
    const cfopVprod: Record<string, number> = {};
    for (const item of detArr) {
      const prod = item['prod'] as Record<string, unknown> | undefined;
      const cfop = String(prod?.['CFOP'] ?? '').trim();
      if (!cfop) continue;
      cfopSet.add(cfop);
      const vProd = parseFloat(String(prod?.['vProd'] ?? '0').replace(',', '.')) || 0;
      cfopVprod[cfop] = (cfopVprod[cfop] ?? 0) + vProd;
    }

    const str = (v: unknown) => { const s = String(v ?? '').trim(); return s || undefined; };

    return {
      chave,
      filename,
      tipo: tipoFinal,
      nNF:       str(ide?.['nNF']),
      serie:     str(ide?.['serie']),
      dhEmi:     str(ide?.['dhEmi'] ?? ide?.['dEmi']),
      cnpjEmit:  str(emit?.['CNPJ']),
      xNomeEmit: str(emit?.['xNome']),
      vNF:       str(icmsTot?.['vNF']),
      cfops:     cfopSet.size > 0 ? [...cfopSet].sort().join(', ') : undefined,
      cfopVprod: Object.keys(cfopVprod).length > 0 ? cfopVprod : undefined,
      vBC:       str(icmsTot?.['vBC']),
      vICMS:     str(icmsTot?.['vICMS']),
      vBCST:     str(icmsTot?.['vBCST']),
      vST:       str(icmsTot?.['vST']),
      vIPI:      str(icmsTot?.['vIPI']),
      vPIS:      str(icmsTot?.['vPIS']),
      vCOFINS:   str(icmsTot?.['vCOFINS']),
      vDesc:     str(icmsTot?.['vDesc']),
      vFrete:    str(icmsTot?.['vFrete']),
      tpNF:      ide?.['tpNF'] !== undefined ? String(ide['tpNF']) : undefined,
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

  private extractFromEventoNFe(
    proc: Record<string, unknown>,
    filename: string,
  ): XmlEntry | null {
    const evento = proc['evento'] as Record<string, unknown> | undefined;
    const infEvento = evento?.['infEvento'] as Record<string, unknown> | undefined;
    const retEvento = proc['retEvento'] as Record<string, unknown> | undefined;
    const infProt = retEvento?.['infProt'] as Record<string, unknown> | undefined;

    /**
     * IMPORTANTE: <chNFe> é um elemento de 44 dígitos numéricos.
     * O fast-xml-parser (parseNodeValue=true por padrão) converte valores de elementos
     * para number, e um inteiro de 44 dígitos ultrapassa a precisão do Number JS (~15 dígitos),
     * resultando em perda de precisão ao converter de volta para string.
     *
     * Solução: extrair a chave do atributo @_Id do infEvento, que é protegido por
     * parseAttributeValue:false e sempre fica como string.
     * Formato do Id: "ID{tpEvento(6)}{chNFe(44)}{nSeqEvento(2)}"
     */
    let chNFe = '';
    const idAttr = String(infEvento?.['@_Id'] ?? '').trim();
    if (idAttr.startsWith('ID') && idAttr.length >= 52) {
      // Posição 8 = depois de "ID" + tpEvento(6), comprimento = 44
      chNFe = idAttr.substring(8, 52);
    }
    // Fallback: tenta retEvento.infProt.chNFe (string, não há risco de overflow pois
    // fast-xml-parser preserva como string quando não parseia atributos)
    if (chNFe.length !== 44) {
      chNFe = String(infProt?.['chNFe'] ?? '').replace(/\D/g, '');
    }
    if (chNFe.length !== 44) return null;

    // tpEvento: 110111 é um número pequeno (6 dígitos), sem risco de overflow
    const tpEvento = String(infEvento?.['tpEvento'] ?? '').trim();
    // Processar apenas eventos de cancelamento (110111)
    if (tpEvento !== '110111') return null;

    const cStat      = String(infProt?.['cStat'] ?? '').trim();
    const xMotivo    = String(infProt?.['xMotivo'] ?? '').trim();
    const dhRegEvento = String(infProt?.['dhRegEvento'] ?? '').trim();
    const detEvento  = infEvento?.['detEvento'] as Record<string, unknown> | undefined;
    const xJust      = String(detEvento?.['xJust'] ?? '').trim();
    const nProt      = String(infProt?.['nProt'] ?? detEvento?.['nProt'] ?? '').trim();

    this.logger.debug(`Evento cancelamento detectado: chave=${chNFe} cStat=${cStat} arquivo=${filename}`);

    return {
      chave: chNFe,
      filename,
      tipo: 'CancelNFe',
      tpEvento,
      cStat:     cStat || '101',
      xMotivo:   xMotivo || 'Cancelamento de NF-e',
      dhRecbto:  dhRegEvento || undefined,
      xJust:     xJust || undefined,
      xNomeEmit: nProt ? `Protocolo: ${nProt}` : undefined,
      autorizada: false,
    };
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
