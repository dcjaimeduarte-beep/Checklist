import { Injectable, Logger } from '@nestjs/common';
import {
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
    let info: SpedInfo = {
      cnpj: '',
      nome: '',
      dtIni: '',
      dtFin: '',
      uf: '',
    };
    let invalidLines = 0;

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
        const entry = this.parseC100(fields);
        if (entry) {
          entries.push(entry);
        } else {
          invalidLines++;
        }
        continue;
      }

      if (reg === 'D100') {
        const entry = this.parseD100(fields);
        if (entry) {
          entries.push(entry);
        } else {
          invalidLines++;
        }
        continue;
      }
    }

    this.logger.log(
      `SPED parseado: ${entries.length} entradas, ${invalidLines} linhas inválidas. CNPJ=${info.cnpj}`,
    );

    return { info, entries, invalidLines };
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
    // |C100|IND_OPER[2]|IND_EMIT[3]|COD_PART[4]|COD_MOD[5]|COD_SIT[6]|SER[7]|NUM_DOC[8]|CHV_NFE[9]|DT_DOC[10]|...
    const indOper = fields[2] ?? '';
    const codMod = fields[5] ?? '';
    const codSit = fields[6] ?? '';
    const ser = fields[7] ?? '';
    const numDoc = fields[8] ?? '';
    const chave = (fields[9] ?? '').replace(/\D/g, '');
    const dtDoc = fields[10] ?? '';

    // Ignorar situações de numeração inutilizada
    if (SPED_SIT_IGNORAR.has(codSit)) return null;

    // Ignorar chaves inválidas
    if (chave.length !== 44) return null;

    return { registro: 'C100', chave, codMod, ser, numDoc, dtDoc, codSit, indOper };
  }

  private parseD100(fields: string[]): SpedEntry | null {
    // |D100|IND_OPER[2]|IND_EMIT[3]|COD_PART[4]|COD_MOD[5]|COD_SIT[6]|SER[7]|SUB[8]|NUM_DOC[9]|CHV_CTE[10]|DT_DOC[11]|...
    const indOper = fields[2] ?? '';
    const codMod = fields[5] ?? '';
    const codSit = fields[6] ?? '';
    const ser = fields[7] ?? '';
    const numDoc = fields[9] ?? '';
    const chave = (fields[10] ?? '').replace(/\D/g, '');
    const dtDoc = fields[11] ?? '';

    if (SPED_SIT_IGNORAR.has(codSit)) return null;
    if (chave.length !== 44) return null;

    return { registro: 'D100', chave, codMod, ser, numDoc, dtDoc, codSit, indOper };
  }
}
