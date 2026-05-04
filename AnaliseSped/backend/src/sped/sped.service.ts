import { Injectable, Logger } from '@nestjs/common';
import {
  SpedC190,
  SpedEntry,
  SpedInfo,
  SpedParseResult,
  SPED_SIT_IGNORAR,
} from './sped.types';

@Injectable()
export class SpedService {
  private readonly logger = new Logger(SpedService.name);

  /**
   * Faz o parse do buffer do arquivo SPED EFD ICMS/IPI.
   * Extrai metadata do registro 0000 e chaves NF-e dos registros C100/D100.
   */
  parse(buffer: Buffer): SpedParseResult {
    // Detectar encoding: remover BOM UTF-8 se presente, senão tratar como latin1
    const hasBom =
      buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
    const text = hasBom
      ? buffer.slice(3).toString('utf8')
      : buffer.toString('latin1');

    const lines = text.split(/\r?\n/);
    const entries: SpedEntry[] = [];
    const cfopSummary: SpedC190[] = [];
    let info: SpedInfo = {
      cnpj: '',
      nome: '',
      dtIni: '',
      dtFin: '',
      uf: '',
    };
    let invalidLines = 0;

    // Entrada pendente aguardando C190 filhos para enriquecer com CFOPs
    let pendingEntry: SpedEntry | null = null;
    let pendingCfopVprod: Record<string, number> = {};

    const finalizePending = () => {
      if (!pendingEntry) return;
      if (Object.keys(pendingCfopVprod).length > 0) {
        pendingEntry.cfopVprod = pendingCfopVprod;
        pendingEntry.cfops = Object.keys(pendingCfopVprod).sort().join(', ');
      }
      entries.push(pendingEntry);
      pendingEntry = null;
      pendingCfopVprod = {};
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const fields = line.split('|');
      // fields[0] = '' (vazio antes do primeiro pipe), fields[1] = REG
      const reg = fields[1];

      if (reg === '0000') {
        info = this.parseHeader(fields);
        continue;
      }

      if (reg === 'C100') {
        finalizePending();
        const entry = this.parseC100(fields);
        if (entry) pendingEntry = entry;
        else invalidLines++;
        continue;
      }

      if (reg === 'D100') {
        finalizePending();
        const entry = this.parseD100(fields);
        if (entry) pendingEntry = entry;
        else invalidLines++;
        continue;
      }

      if (reg === 'C190') {
        const c190 = this.parseC190(fields);
        if (c190) {
          cfopSummary.push(c190);
          // Associa ao C100 pai (C190 é filho de C100, não de D100)
          if (pendingEntry?.registro === 'C100') {
            pendingCfopVprod[c190.cfop] = (pendingCfopVprod[c190.cfop] ?? 0) + c190.vlOpr;
          }
        }
        continue;
      }
    }

    finalizePending();

    this.logger.log(
      `SPED parseado: ${entries.length} entradas, ${cfopSummary.length} CFOPs, ${invalidLines} linhas inválidas. CNPJ=${info.cnpj}`,
    );

    return { info, entries, cfopSummary, invalidLines };
  }

  private parseHeader(fields: string[]): SpedInfo {
    return {
      dtIni: fields[4] ?? '',
      dtFin: fields[5] ?? '',
      nome: fields[6] ?? '',
      cnpj: fields[7] ?? '',
      uf: fields[9] ?? '',
    };
  }

  private parseC100(fields: string[]): SpedEntry | null {
    // |C100|IND_OPER[2]|IND_EMIT[3]|COD_PART[4]|COD_MOD[5]|COD_SIT[6]|SER[7]|NUM_DOC[8]|CHV_NFE[9]|DT_DOC[10]|DT_E_S[11]|VL_DOC[12]|
    // VL_DESC[13]|VL_ABO[14]|VL_MERC[15]|VL_FRETE[16]|VL_SEG[17]|VL_OUT_DA[18]|VL_BC_ICMS[19]|VL_ICMS[20]|VL_BC_ICMS_ST[21]|VL_ICMS_ST[22]|VL_IPI[23]|VL_PIS[24]|VL_COFINS[25]|
    const indOper    = fields[2] ?? '';
    const indEmit    = fields[3] ?? '';
    const codMod     = fields[5] ?? '';
    const codSit     = fields[6] ?? '';
    const ser        = fields[7] ?? '';
    const numDoc     = fields[8] ?? '';
    const chave      = (fields[9] ?? '').replace(/\D/g, '');
    const dtDoc      = fields[10] ?? '';
    const vlDoc      = this.parseNum(fields[12]);
    const vlBcIcms   = this.parseNum(fields[19]);
    const vlIcms     = this.parseNum(fields[20]);
    const vlBcIcmsSt = this.parseNum(fields[21]);
    const vlIcmsSt   = this.parseNum(fields[22]);
    const vlIpi      = this.parseNum(fields[23]);
    const vlPis      = this.parseNum(fields[24]);
    const vlCofins   = this.parseNum(fields[25]);

    if (SPED_SIT_IGNORAR.has(codSit)) return null;
    if (chave.length !== 44) return null;

    return { registro: 'C100', chave, codMod, ser, numDoc, dtDoc, codSit, indOper, indEmit, vlDoc, vlBcIcms, vlIcms, vlBcIcmsSt, vlIcmsSt, vlIpi, vlPis, vlCofins };
  }

  private parseD100(fields: string[]): SpedEntry | null {
    // |D100|IND_OPER[2]|IND_EMIT[3]|COD_PART[4]|COD_MOD[5]|COD_SIT[6]|SER[7]|SUB[8]|NUM_DOC[9]|CHV_CTE[10]|DT_DOC[11]|DT_A_P[12]|TP_CT-e[13]|CHV_CTE_REF[14]|VL_DOC[15]|
    // VL_DESC[16]|VL_MERC[17]|...|VL_BC_ICMS[21]|VL_ICMS[22]|VL_BC_ICMS_ST[23]|VL_ICMS_ST[24]|...|VL_PIS[26]|VL_COFINS[27]|
    const indOper    = fields[2] ?? '';
    const indEmit    = fields[3] ?? '';
    const codMod     = fields[5] ?? '';
    const codSit     = fields[6] ?? '';
    const ser        = fields[7] ?? '';
    const numDoc     = fields[9] ?? '';
    const chave      = (fields[10] ?? '').replace(/\D/g, '');
    const dtDoc      = fields[11] ?? '';
    const vlDoc      = this.parseNum(fields[15]);
    // D100 não tem IPI — campos de ICMS em posições diferentes
    const vlBcIcms   = this.parseNum(fields[21]);
    const vlIcms     = this.parseNum(fields[22]);
    const vlBcIcmsSt = this.parseNum(fields[23]);
    const vlIcmsSt   = this.parseNum(fields[24]);
    const vlPis      = this.parseNum(fields[26]);
    const vlCofins   = this.parseNum(fields[27]);

    if (SPED_SIT_IGNORAR.has(codSit)) return null;
    if (chave.length !== 44) return null;

    return { registro: 'D100', chave, codMod, ser, numDoc, dtDoc, codSit, indOper, indEmit, vlDoc, vlBcIcms, vlIcms, vlBcIcmsSt, vlIcmsSt, vlIpi: 0, vlPis, vlCofins };
  }

  private parseC190(fields: string[]): SpedC190 | null {
    // |C190|CST_ICMS[2]|CFOP[3]|ALIQ_ICMS[4]|VL_BC_ICMS[5]|VL_ICMS[6]|VL_BC_ICMS_ST[7]|VL_ICMS_ST[8]|VL_RED_BC[9]|VL_OPR[10]|
    const cfop = (fields[3] ?? '').trim();
    if (!cfop) return null;
    return {
      cstIcms:    (fields[2] ?? '').trim(),
      cfop,
      aliqIcms:   this.parseNum(fields[4]),
      vlBcIcms:   this.parseNum(fields[5]),
      vlIcms:     this.parseNum(fields[6]),
      vlBcIcmsSt: this.parseNum(fields[7]),
      vlIcmsSt:   this.parseNum(fields[8]),
      vlOpr:      this.parseNum(fields[10]),
    };
  }

  private parseNum(raw: string | undefined): number {
    if (!raw) return 0;
    return parseFloat(raw.replace(',', '.')) || 0;
  }
}
