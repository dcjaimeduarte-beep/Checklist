import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';

import { getDocsPath } from '../config/docs-path';
import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { Lc214ChunkEntity } from '../entities/lc214-chunk.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';

const LC_PDF = 'Lcp 214.pdf';
const CCLASS_XLSX = 'cClassTrib 2026-01-23_Public.xlsx';
const NCM_XLSX = 'Tabela_NCM_Vigente_20260331.xlsx';

const CHUNK_SIZE = 4500;

@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(Lc214ChunkEntity)
    private readonly lcRepo: Repository<Lc214ChunkEntity>,
    @InjectRepository(NcmRowEntity)
    private readonly ncmRepo: Repository<NcmRowEntity>,
    @InjectRepository(CclassTribRowEntity)
    private readonly cclassRepo: Repository<CclassTribRowEntity>,
  ) {}

  onModuleInit(): void {
    void this.ingestDeferred();
  }

  private async ingestDeferred(): Promise<void> {
    try {
      await this.runIngestionIfNeeded();
    } catch (err) {
      this.logger.warn(`Ingestão inicial falhou (continua sem dados locais): ${String(err)}`);
    }
  }

  /** Ingestão LC 214 + planilhas; reexecutar com FORCE_REINGEST=1. */
  async runIngestionIfNeeded(): Promise<void> {
    const force = process.env.FORCE_REINGEST === '1' || process.env.FORCE_REINGEST === 'true';
    const docs = getDocsPath();

    if (!existsSync(docs)) {
      this.logger.warn(`Pasta docs não encontrada: ${docs}`);
      return;
    }

    const [lcCount, ncmCount, ccCount] = await Promise.all([
      this.lcRepo.count(),
      this.ncmRepo.count(),
      this.cclassRepo.count(),
    ]);

    if (!force && lcCount + ncmCount + ccCount > 0) {
      this.logger.log('Base já contém dados de ingestão; ignorando (use FORCE_REINGEST=1 para refazer).');
      return;
    }

    if (force) {
      await this.lcRepo.clear();
      await this.ncmRepo.clear();
      await this.cclassRepo.clear();
    }

    await this.ingestLc214Pdf(join(docs, LC_PDF));
    await this.ingestCclass(join(docs, CCLASS_XLSX));
    await this.ingestNcm(join(docs, NCM_XLSX));

    this.logger.log('Ingestão de documentos concluída.');
  }

  private async ingestLc214Pdf(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      this.logger.warn(`Ficheiro LC 214 em falta: ${filePath}`);
      return;
    }
    try {
      const buffer = await readFile(filePath);
      const mod = (await import('pdf-parse')) as unknown as {
        default?: (b: Buffer) => Promise<{ text: string }>;
      };
      const pdfParse = mod.default ?? (mod as unknown as (b: Buffer) => Promise<{ text: string }>);
      const data = await pdfParse(buffer);
      const fullText = data.text?.trim() ?? '';
      if (!fullText.length) {
        this.logger.warn('PDF LC 214 sem texto extraível.');
        return;
      }
      let chunkIndex = 0;
      for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
        const text = fullText.slice(i, i + CHUNK_SIZE);
        await this.lcRepo.save(
          this.lcRepo.create({
            pageNumber: 0,
            chunkIndex,
            text,
          }),
        );
        chunkIndex += 1;
      }
      this.logger.log(`LC 214: ${chunkIndex} blocos indexados (${basename(filePath)}).`);
    } catch (e) {
      this.logger.warn(`Erro ao processar PDF LC 214: ${String(e)}`);
    }
  }

  private async ingestCclass(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      this.logger.warn(`Planilha cClassTrib em falta: ${filePath}`);
      return;
    }
    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      let n = 0;
      for (const row of rows) {
        if (Object.keys(row).length === 0) continue;
        await this.cclassRepo.save(this.cclassRepo.create({ rowData: row }));
        n += 1;
      }
      this.logger.log(`cClassTrib: ${n} linhas (${basename(filePath)}).`);
    } catch (e) {
      this.logger.warn(`Erro ao ler cClassTrib: ${String(e)}`);
    }
  }

  private async ingestNcm(filePath: string): Promise<void> {
    if (!existsSync(filePath)) {
      this.logger.warn(`Planilha NCM em falta: ${filePath}`);
      return;
    }
    try {
      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      let n = 0;
      for (const row of rows) {
        const { code, description } = this.pickNcmCodeAndDescription(row);
        if (!code) continue;
        await this.ncmRepo.save(
          this.ncmRepo.create({
            ncmCode: code,
            description,
            rawRow: row,
          }),
        );
        n += 1;
      }
      this.logger.log(`NCM: ${n} linhas (${basename(filePath)}).`);
    } catch (e) {
      this.logger.warn(`Erro ao ler NCM: ${String(e)}`);
    }
  }

  /**
   * Heurística: coluna com código NCM (2–8 dígitos após remover pontos)
   * + descrição mais longa. Aceita também códigos de capítulo/posição
   * (ex.: "30", "30.04", "3004.90") para manter a hierarquia NCM.
   */
  private pickNcmCodeAndDescription(row: Record<string, unknown>): {
    code: string | null;
    description: string;
  } {
    const values = Object.values(row).map((v) => String(v ?? '').trim());
    let code: string | null = null;
    let description = '';

    /* Aceita formatos como: 30, 30.04, 3004.10, 3004.10.1, 3004.10.11 */
    const reNcm = /^\d{2,4}(\.\d{1,2}){0,2}$/;
    for (const v of values) {
      if (reNcm.test(v)) {
        const digits = v.replace(/\D/g, '');
        if (digits.length >= 2 && digits.length <= 8) {
          code = digits;
          break;
        }
      }
      /* Já sem pontos: 8 dígitos puros */
      const normalized = v.replace(/\D/g, '');
      if (v === normalized && normalized.length === 8) {
        code = normalized;
        break;
      }
    }

    for (const [k, val] of Object.entries(row)) {
      if (/descri|nome|texto|mercador/i.test(k)) {
        description = String(val ?? '');
        break;
      }
    }
    if (!description) {
      const longest = values.filter((v) => v.length > 10).sort((a, b) => b.length - a.length)[0];
      description = longest ?? '';
    }

    return { code, description };
  }
}
