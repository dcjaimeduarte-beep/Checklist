import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { XMLParser } from 'fast-xml-parser';

import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';
import {
  REF_IBS_RATE,
  REF_CBS_RATE,
  parseCclassRow,
  resolveNcmHierarchyFromMap,
  findCclassMatchesInMemory,
  pickBestCclass,
} from '../consultation/tax-analysis.utils';

/** Colunas de entrada geradas a partir do XML NF-e */
const XML_INPUT_HEADERS = ['Item', 'Código Produto', 'Descrição', 'NCM'];

/** Campos por variante de classificação */
const VARIANT_FIELDS = [
  'cClassTrib',
  'CST-IBS/CBS',
  'Nome cClassTrib',
  'Tipo Alíquota',
  'Red IBS%',
  'Red CBS%',
  'IBS efetivo',
  'CBS efetivo',
  'Artigo LC 214',
];

/** Rótulos das variantes (Principal + alternativas) */
const VARIANT_LABELS = ['Principal', 'Alt. 1', 'Alt. 2'];
const MAX_VARIANTS = VARIANT_LABELS.length;

/** Cabeçalhos de saída: 9 campos × 3 variantes = 27 colunas */
const OUTPUT_HEADERS = VARIANT_LABELS.flatMap((label) =>
  VARIANT_FIELDS.map((f) => `${f} (${label})`),
);

/* ─── Paleta visual ─── */
const PALETTE = {
  /** Cabeçalho das colunas de entrada (cinza-escuro) */
  INPUT_HEADER:      'FF374151',
  /** Cabeçalho Principal (azul-marinho) */
  PRINCIPAL_HEADER:  'FF1E3A5F',
  /** Cabeçalho Alt. 1 (verde-escuro) */
  ALT1_HEADER:       'FF14532D',
  /** Cabeçalho Alt. 2 (vinho/tijolo) */
  ALT2_HEADER:       'FF7C2D12',
  /** Fundo linhas ímpares — zona Principal */
  PRINCIPAL_ODD:     'FFDBEAFE',
  /** Fundo linhas ímpares — zona Alt. 1 */
  ALT1_ODD:          'FFD1FAE5',
  /** Fundo linhas ímpares — zona Alt. 2 */
  ALT2_ODD:          'FFFDE8D0',
  /** Fundo linhas pares — zona Principal */
  PRINCIPAL_EVEN:    'FFEFF6FF',
  /** Fundo linhas pares — zona Alt. 1 */
  ALT1_EVEN:         'FFF0FDF4',
  /** Fundo linhas pares — zona Alt. 2 */
  ALT2_EVEN:         'FFFFF7ED',
  /** Fundo linhas ímpares — colunas de entrada */
  INPUT_ODD:         'FFF1F5F9',
  /** Texto branco */
  WHITE:             'FFFFFFFF',
  /** Texto escuro padrão */
  DARK:              'FF1E293B',
};

/** Larguras aproximadas por campo de variante (em caracteres Excel) */
const VARIANT_COL_WIDTHS = [12, 14, 40, 16, 10, 10, 13, 13, 18];

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);

  constructor(
    @InjectRepository(NcmRowEntity)
    private readonly ncmRepo: Repository<NcmRowEntity>,
    @InjectRepository(CclassTribRowEntity)
    private readonly cclassRepo: Repository<CclassTribRowEntity>,
  ) {}

  async processFile(buffer: Buffer): Promise<Buffer> {
    /* 1. Carregar dados em memória */
    const [allNcm, allCclass] = await Promise.all([
      this.ncmRepo.find(),
      this.cclassRepo.find(),
    ]);

    const ncmMap = new Map<string, NcmRowEntity>();
    for (const row of allNcm) ncmMap.set(row.ncmCode, row);

    const cclassTexts = allCclass.map((e) => JSON.stringify(e.rowData).toLowerCase());
    this.logger.log(`Batch: ${allNcm.length} NCM rows, ${allCclass.length} cClassTrib rows em memória.`);

    /* 2. Ler XLSX de entrada */
    const wb = XLSX.read(buffer, { cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const inputRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (inputRows.length < 2) throw new Error('Planilha vazia ou sem dados.');

    /* 3. Detectar coluna NCM */
    const headerRow = inputRows[0] as string[];
    let ncmCol = 0;
    for (let c = 0; c < headerRow.length; c++) {
      const h = String(headerRow[c] ?? '').trim().toUpperCase();
      if (h === 'NCM' || h === 'CÓDIGO NCM' || h === 'COD NCM' || h === 'NCM/SH') {
        ncmCol = c;
        break;
      }
    }
    this.logger.log(`Batch: Coluna NCM no índice ${ncmCol} ("${headerRow[ncmCol]}").`);

    /* 4. Montar linhas de dados */
    const outputStart = headerRow.length;
    const outHeader = [...headerRow, ...OUTPUT_HEADERS] as string[];
    const dataRows: unknown[][] = [];
    let processed = 0;
    let totalClassifications = 0;

    for (let r = 1; r < inputRows.length; r++) {
      const srcRow = inputRows[r] as unknown[];
      const rawNcm = String(srcRow[ncmCol] ?? '').trim();
      const ncmDigits = rawNcm.replace(/\D/g, '').padStart(8, '0').slice(0, 8);

      const row = [...srcRow];
      for (let i = 0; i < OUTPUT_HEADERS.length; i++) row[outputStart + i] = '';

      if (!ncmDigits || ncmDigits === '00000000') {
        dataRows.push(row);
        continue;
      }

      srcRow[ncmCol] = ncmDigits;

      const hierarchy = resolveNcmHierarchyFromMap(ncmDigits, ncmMap);
      const matches = findCclassMatchesInMemory(ncmDigits, hierarchy, allCclass, cclassTexts);

      if (matches.length === 0) {
        dataRows.push(row);
        processed++;
        continue;
      }

      const variants = this.sortByScore(matches).slice(0, MAX_VARIANTS);
      for (let m = 0; m < variants.length; m++) {
        const p = parseCclassRow(variants[m].rowData as Record<string, unknown>);
        const effIBS = REF_IBS_RATE * (1 - p.pRedIBS / 100);
        const effCBS = REF_CBS_RATE * (1 - p.pRedCBS / 100);
        const base = outputStart + m * VARIANT_FIELDS.length;
        row[base + 0] = p.cClassTrib;
        row[base + 1] = p.cstIbsCbs;
        row[base + 2] = p.name;
        row[base + 3] = p.pRedIBS > 0 ? 'Reduzida' : p.rateType;
        row[base + 4] = p.pRedIBS > 0 ? `${p.pRedIBS}%` : '0%';
        row[base + 5] = p.pRedCBS > 0 ? `${p.pRedCBS}%` : '0%';
        row[base + 6] = `${(effIBS * 100).toFixed(2)}%`;
        row[base + 7] = `${(effCBS * 100).toFixed(2)}%`;
        row[base + 8] = p.lcArticle || '';
        totalClassifications++;
      }

      dataRows.push(row);
      processed++;
    }

    this.logger.log(
      `Batch: ${processed} NCMs processados, ${totalClassifications} classificações geradas (${dataRows.length} linhas).`,
    );

    return this.writeStyledBuffer(sheetName, outHeader, dataRows, outputStart);
  }

  async processXmlFile(buffer: Buffer): Promise<Buffer> {
    /* 1. Carregar dados de referência */
    const [allNcm, allCclass] = await Promise.all([
      this.ncmRepo.find(),
      this.cclassRepo.find(),
    ]);

    const ncmMap = new Map<string, NcmRowEntity>();
    for (const row of allNcm) ncmMap.set(row.ncmCode, row);

    const cclassTexts = allCclass.map((e) => JSON.stringify(e.rowData).toLowerCase());

    /* 2. Parsear XML */
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => name === 'det',
      removeNSPrefix: true,
      parseTagValue: true,
    });

    let parsed: Record<string, unknown>;
    try {
      parsed = parser.parse(buffer.toString('utf-8')) as Record<string, unknown>;
    } catch {
      throw new Error('XML inválido ou corrompido. Verifique o arquivo e tente novamente.');
    }

    type AnyObj = Record<string, unknown>;
    const nfeRoot =
      (parsed['nfeProc'] as AnyObj | undefined)?.['NFe'] ??
      parsed['NFe'];
    const infNFe = (nfeRoot as AnyObj | undefined)?.['infNFe'] as AnyObj | undefined;
    const detList = (infNFe?.['det'] as AnyObj[] | undefined) ?? [];

    if (detList.length === 0) {
      throw new Error('Nenhum item (det) encontrado no XML. Verifique se é uma NF-e válida.');
    }

    this.logger.log(`XML: ${detList.length} itens encontrados.`);

    interface XmlItem { nItem: string; cProd: string; xProd: string; ncm: string; }

    const items: XmlItem[] = detList.map((det) => {
      const prod = (det['prod'] ?? {}) as AnyObj;
      const rawNcm = String(prod['NCM'] ?? '').trim();
      return {
        nItem: String(det['@_nItem'] ?? ''),
        cProd: String(prod['cProd'] ?? ''),
        xProd: String(prod['xProd'] ?? ''),
        ncm: rawNcm.replace(/\D/g, '').padStart(8, '0').slice(0, 8),
      };
    });

    /* 3. Montar linhas de saída */
    const outHeader = [...XML_INPUT_HEADERS, ...OUTPUT_HEADERS] as string[];
    const xmlInputLen = XML_INPUT_HEADERS.length;
    const dataRows: unknown[][] = [];
    let processed = 0;
    let totalClassifications = 0;

    for (const item of items) {
      const baseRow: unknown[] = [item.nItem, item.cProd, item.xProd, item.ncm];
      for (let i = 0; i < OUTPUT_HEADERS.length; i++) baseRow.push('');

      if (!item.ncm || item.ncm === '00000000') {
        dataRows.push(baseRow);
        continue;
      }

      const hierarchy = resolveNcmHierarchyFromMap(item.ncm, ncmMap);
      const matches = findCclassMatchesInMemory(item.ncm, hierarchy, allCclass, cclassTexts);

      if (matches.length === 0) {
        dataRows.push(baseRow);
        processed++;
        continue;
      }

      const variants = this.sortByScore(matches).slice(0, MAX_VARIANTS);
      for (let m = 0; m < variants.length; m++) {
        const p = parseCclassRow(variants[m].rowData as Record<string, unknown>);
        const effIBS = REF_IBS_RATE * (1 - p.pRedIBS / 100);
        const effCBS = REF_CBS_RATE * (1 - p.pRedCBS / 100);
        const base = xmlInputLen + m * VARIANT_FIELDS.length;
        baseRow[base + 0] = p.cClassTrib;
        baseRow[base + 1] = p.cstIbsCbs;
        baseRow[base + 2] = p.name;
        baseRow[base + 3] = p.pRedIBS > 0 ? 'Reduzida' : p.rateType;
        baseRow[base + 4] = p.pRedIBS > 0 ? `${p.pRedIBS}%` : '0%';
        baseRow[base + 5] = p.pRedCBS > 0 ? `${p.pRedCBS}%` : '0%';
        baseRow[base + 6] = `${(effIBS * 100).toFixed(2)}%`;
        baseRow[base + 7] = `${(effCBS * 100).toFixed(2)}%`;
        baseRow[base + 8] = p.lcArticle || '';
        totalClassifications++;
      }

      dataRows.push(baseRow);
      processed++;
    }

    this.logger.log(
      `XML: ${processed} NCMs processados, ${totalClassifications} classificações geradas (${dataRows.length} linhas).`,
    );

    return this.writeStyledBuffer('Itens NF-e', outHeader, dataRows, xmlInputLen);
  }

  /**
   * Processa múltiplos XMLs NF-e e consolida todos os itens em um único XLSX.
   * Adiciona coluna "Arquivo NF-e" no início de cada linha para identificar a origem.
   */
  async mergeXmlFiles(files: { buffer: Buffer; name: string }[]): Promise<Buffer> {
    const [allNcm, allCclass] = await Promise.all([
      this.ncmRepo.find(),
      this.cclassRepo.find(),
    ]);

    const ncmMap = new Map<string, NcmRowEntity>();
    for (const row of allNcm) ncmMap.set(row.ncmCode, row);

    const cclassTexts = allCclass.map((e) => JSON.stringify(e.rowData).toLowerCase());

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (name) => name === 'det',
      removeNSPrefix: true,
      parseTagValue: true,
    });

    const MERGED_INPUT_HEADERS = ['Arquivo NF-e', ...XML_INPUT_HEADERS];
    const mergedInputCount = MERGED_INPUT_HEADERS.length;
    const outHeader = [...MERGED_INPUT_HEADERS, ...OUTPUT_HEADERS] as string[];
    const dataRows: unknown[][] = [];
    let totalClassifications = 0;

    for (const { buffer, name } of files) {
      /* Parsear XML */
      let parsed: Record<string, unknown>;
      try {
        parsed = parser.parse(buffer.toString('utf-8')) as Record<string, unknown>;
      } catch {
        this.logger.warn(`mergeXml: XML inválido ignorado — ${name}`);
        continue;
      }

      type AnyObj = Record<string, unknown>;
      const nfeRoot =
        (parsed['nfeProc'] as AnyObj | undefined)?.['NFe'] ??
        parsed['NFe'];
      const infNFe = (nfeRoot as AnyObj | undefined)?.['infNFe'] as AnyObj | undefined;
      const detList = (infNFe?.['det'] as AnyObj[] | undefined) ?? [];

      if (detList.length === 0) {
        this.logger.warn(`mergeXml: Nenhum item det encontrado em ${name}`);
        continue;
      }

      const fileLabel = name.replace(/\.xml$/i, '');

      for (const det of detList) {
        const prod = (det['prod'] ?? {}) as AnyObj;
        const rawNcm = String(prod['NCM'] ?? '').trim();
        const ncm = rawNcm.replace(/\D/g, '').padStart(8, '0').slice(0, 8);

        const baseRow: unknown[] = [
          fileLabel,
          String(det['@_nItem'] ?? ''),
          String(prod['cProd'] ?? ''),
          String(prod['xProd'] ?? ''),
          ncm,
        ];
        for (let i = 0; i < OUTPUT_HEADERS.length; i++) baseRow.push('');

        if (!ncm || ncm === '00000000') {
          dataRows.push(baseRow);
          continue;
        }

        const hierarchy = resolveNcmHierarchyFromMap(ncm, ncmMap);
        const matches = findCclassMatchesInMemory(ncm, hierarchy, allCclass, cclassTexts);

        if (matches.length === 0) {
          dataRows.push(baseRow);
          continue;
        }

        const variants = this.sortByScore(matches).slice(0, MAX_VARIANTS);
        for (let m = 0; m < variants.length; m++) {
          const p = parseCclassRow(variants[m].rowData as Record<string, unknown>);
          const effIBS = REF_IBS_RATE * (1 - p.pRedIBS / 100);
          const effCBS = REF_CBS_RATE * (1 - p.pRedCBS / 100);
          const base = mergedInputCount + m * VARIANT_FIELDS.length;
          baseRow[base + 0] = p.cClassTrib;
          baseRow[base + 1] = p.cstIbsCbs;
          baseRow[base + 2] = p.name;
          baseRow[base + 3] = p.pRedIBS > 0 ? 'Reduzida' : p.rateType;
          baseRow[base + 4] = p.pRedIBS > 0 ? `${p.pRedIBS}%` : '0%';
          baseRow[base + 5] = p.pRedCBS > 0 ? `${p.pRedCBS}%` : '0%';
          baseRow[base + 6] = `${(effIBS * 100).toFixed(2)}%`;
          baseRow[base + 7] = `${(effCBS * 100).toFixed(2)}%`;
          baseRow[base + 8] = p.lcArticle || '';
          totalClassifications++;
        }

        dataRows.push(baseRow);
      }
    }

    this.logger.log(
      `mergeXml: ${files.length} arquivos, ${dataRows.length} itens, ${totalClassifications} classificações.`,
    );

    return this.writeStyledBuffer('NF-e Consolidado', outHeader, dataRows, mergedInputCount);
  }

  /**
   * Gera buffer XLSX com formatação visual por zona de variante.
   * @param sheetName  Nome da aba
   * @param header     Linha de cabeçalho completa (input cols + output cols)
   * @param dataRows   Linhas de dados (sem o cabeçalho)
   * @param inputCount Número de colunas de entrada (antes das colunas de variantes)
   */
  private async writeStyledBuffer(
    sheetName: string,
    header: string[],
    dataRows: unknown[][],
    inputCount: number,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);

    const totalCols = header.length;

    /* ── Larguras das colunas ── */
    for (let c = 1; c <= totalCols; c++) {
      const variantOffset = c - 1 - inputCount; // índice dentro dos blocos de variante
      if (variantOffset >= 0) {
        const fieldIdx = variantOffset % VARIANT_FIELDS.length;
        sheet.getColumn(c).width = VARIANT_COL_WIDTHS[fieldIdx];
      } else {
        /* Colunas de entrada: largura pelo nome do cabeçalho */
        sheet.getColumn(c).width = Math.max(12, Math.min(30, (header[c - 1] ?? '').length + 4));
      }
    }

    /* ── Cabeçalho ── */
    const headerRow = sheet.addRow(header);
    headerRow.height = 32;

    for (let c = 1; c <= totalCols; c++) {
      const cell = headerRow.getCell(c);
      const variantOffset = c - 1 - inputCount;
      let bgColor = PALETTE.INPUT_HEADER;

      if (variantOffset >= 0) {
        const variantIndex = Math.floor(variantOffset / VARIANT_FIELDS.length);
        const headerColors = [PALETTE.PRINCIPAL_HEADER, PALETTE.ALT1_HEADER, PALETTE.ALT2_HEADER];
        bgColor = headerColors[variantIndex] ?? PALETTE.INPUT_HEADER;
      }

      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
      cell.font   = { bold: true, color: { argb: PALETTE.WHITE }, size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
        left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right:  { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };

      /* Borda esquerda mais grossa no início de cada bloco de variante */
      const isZoneBoundary = variantOffset >= 0 && variantOffset % VARIANT_FIELDS.length === 0;
      if (isZoneBoundary || c - 1 === inputCount) {
        cell.border = { ...cell.border, left: { style: 'medium', color: { argb: 'FF94A3B8' } } };
      }
    }

    /* ── Linhas de dados ── */
    for (let r = 0; r < dataRows.length; r++) {
      const rowData = dataRows[r] as unknown[];
      const exRow = sheet.addRow(rowData as ExcelJS.CellValue[]);
      exRow.height = 18;

      const isOdd = r % 2 === 1;

      for (let c = 1; c <= totalCols; c++) {
        const cell = exRow.getCell(c);
        const variantOffset = c - 1 - inputCount;
        let bgColor = isOdd ? PALETTE.INPUT_ODD : 'FFFFFFFF';

        if (variantOffset >= 0) {
          const variantIndex = Math.floor(variantOffset / VARIANT_FIELDS.length);
          const zoneColors: [string, string][] = [
            [PALETTE.PRINCIPAL_ODD, PALETTE.PRINCIPAL_EVEN],
            [PALETTE.ALT1_ODD,      PALETTE.ALT1_EVEN],
            [PALETTE.ALT2_ODD,      PALETTE.ALT2_EVEN],
          ];
          const zone = zoneColors[variantIndex] ?? [PALETTE.INPUT_ODD, 'FFFFFFFF'];
          bgColor = isOdd ? zone[0] : zone[1];
        }

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.font = { size: 10, name: 'Calibri', color: { argb: PALETTE.DARK } };
        cell.alignment = { vertical: 'middle' };
        cell.border = {
          top:    { style: 'hair', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          left:   { style: 'hair', color: { argb: 'FFE2E8F0' } },
          right:  { style: 'hair', color: { argb: 'FFE2E8F0' } },
        };

        /* Borda esquerda mais grossa no início de cada bloco de variante */
        const isZoneBoundary = variantOffset >= 0 && variantOffset % VARIANT_FIELDS.length === 0;
        if (isZoneBoundary || c - 1 === inputCount) {
          cell.border = { ...cell.border, left: { style: 'thin', color: { argb: 'FF94A3B8' } } };
        }

        /* Negrito para cClassTrib e CST (primeiros 2 campos de cada variante) */
        const fieldIdx = variantOffset % VARIANT_FIELDS.length;
        if (variantOffset >= 0 && (fieldIdx === 0 || fieldIdx === 1)) {
          cell.font = { ...cell.font, bold: true };
        }
      }
    }

    /* ── Congelar primeira linha ── */
    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

    /* ── Auto-filtro no cabeçalho ── */
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: totalCols } };

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private sortByScore(entities: CclassTribRowEntity[]): CclassTribRowEntity[] {
    return [...entities].sort((a, b) => this.entityScore(b) - this.entityScore(a));
  }

  private entityScore(e: CclassTribRowEntity): number {
    const d = e.rowData as Record<string, unknown>;
    const cst  = String(d['CST-IBS/CBS'] ?? '');
    const pRed = Number(d['pRedIBS']) || 0;
    const name = String(d['Nome cClassTrib'] ?? '');

    let score = 0;
    if (cst === '200') score += 20;
    else if (cst === '000') score += 10;
    else if (cst.startsWith('5') || cst.startsWith('4') || cst.startsWith('6') || cst.startsWith('8')) score -= 10;

    if (pRed > 0 && pRed < 100) score += 15;
    else if (pRed === 100) score += 8;
    else score += 3;

    if (name.length > 30) score += 2;
    return score;
  }
}
