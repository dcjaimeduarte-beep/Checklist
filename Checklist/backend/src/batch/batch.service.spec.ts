import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as XLSX from 'xlsx';

import { NcmRowEntity } from '../entities/ncm-row.entity';
import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { BatchService } from './batch.service';

/* ─── Mock data ─── */

const mockNcmRows: Partial<NcmRowEntity>[] = [
  { id: '1', ncmCode: '30', description: 'Produtos farmacêuticos.', rawRow: null },
  { id: '2', ncmCode: '3004', description: 'Medicamentos para fins terapêuticos.', rawRow: null },
  { id: '3', ncmCode: '30049090', description: '', rawRow: null },
];

const mockCclassRows: Partial<CclassTribRowEntity>[] = [
  {
    id: '1',
    rowData: {
      'CST-IBS/CBS': '200',
      'Descrição CST-IBS/CBS': 'Alíquota reduzida',
      'cClassTrib': '200032',
      'Nome cClassTrib': 'Fornecimento dos medicamentos registrados na Anvisa',
      'Tipo de Alíquota': 'Reduzida',
      'pRedIBS': 60,
      'pRedCBS': 60,
      'LC 214/25': 'Art. 133',
      'LC Redação': '',
    },
  },
];

function createTestXlsx(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function buildNfeXml(items: { nItem: string; cProd: string; xProd: string; NCM: string; uCom: string; qCom: string; vProd: string }[]): Buffer {
  const dets = items
    .map(
      (it) =>
        `<det nItem="${it.nItem}"><prod>` +
        `<cProd>${it.cProd}</cProd>` +
        `<xProd>${it.xProd}</xProd>` +
        `<NCM>${it.NCM}</NCM>` +
        `<uCom>${it.uCom}</uCom>` +
        `<qCom>${it.qCom}</qCom>` +
        `<vProd>${it.vProd}</vProd>` +
        `</prod></det>`,
    )
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><nfeProc><NFe><infNFe>${dets}</infNFe></NFe></nfeProc>`;
  return Buffer.from(xml, 'utf-8');
}

describe('BatchService', () => {
  let service: BatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchService,
        {
          provide: getRepositoryToken(NcmRowEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockNcmRows) },
        },
        {
          provide: getRepositoryToken(CclassTribRowEntity),
          useValue: { find: jest.fn().mockResolvedValue(mockCclassRows) },
        },
      ],
    }).compile();

    service = module.get<BatchService>(BatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('processes XLSX with NCM in column A', async () => {
    const input = createTestXlsx([
      ['NCM', 'Descrição'],
      ['30049090', 'Medicamentos'],
    ]);

    const result = await service.processFile(input);
    expect(result).toBeInstanceOf(Buffer);

    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    // Should have added output headers with variant suffixes
    const headers = rows[0] as string[];
    expect(headers).toContain('cClassTrib (Principal)');
    expect(headers).toContain('CST-IBS/CBS (Principal)');
    expect(headers).toContain('IBS efetivo (Principal)');

    // Should have filled data in Principal columns
    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('200032');
    expect(dataRow[headers.indexOf('CST-IBS/CBS (Principal)')]).toBe('200');
    expect(dataRow[headers.indexOf('Red IBS% (Principal)')]).toBe('60%');
  });

  it('auto-detects NCM column by header name', async () => {
    const input = createTestXlsx([
      ['COD', 'DESC', 'NCM'],
      [5010, 'Produto teste', '30049090'],
    ]);

    const result = await service.processFile(input);
    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    const headers = rows[0] as string[];
    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('200032');
  });

  it('handles rows with NCM 00000000 (skip)', async () => {
    const input = createTestXlsx([
      ['NCM', 'Descrição'],
      ['00000000', 'Não especificado'],
    ]);

    const result = await service.processFile(input);
    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    const headers = rows[0] as string[];
    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('');
  });

  it('handles numeric NCM values', async () => {
    const input = createTestXlsx([
      ['NCM', 'Descrição'],
      [30049090, 'Medicamentos como número'],
    ]);

    const result = await service.processFile(input);
    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    const headers = rows[0] as string[];
    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('200032');
  });

  it('throws on empty spreadsheet', async () => {
    const input = createTestXlsx([['NCM']]);
    await expect(service.processFile(input)).rejects.toThrow('Planilha vazia');
  });

  /* ── processXmlFile tests ── */

  it('processXmlFile: processa NF-e XML com item NCM conhecido', async () => {
    const xml = buildNfeXml([
      { nItem: '1', cProd: 'MED001', xProd: 'Medicamento', NCM: '30049090', uCom: 'UN', qCom: '10', vProd: '100.00' },
    ]);

    const result = await service.processXmlFile(xml);
    expect(result).toBeInstanceOf(Buffer);

    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    const headers = rows[0] as string[];
    expect(headers).toContain('Descrição');
    expect(headers).toContain('NCM');
    expect(headers).toContain('cClassTrib (Principal)');
    expect(headers).toContain('CST-IBS/CBS (Principal)');
    expect(headers).toContain('Artigo LC 214 (Principal)');

    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('Código Produto')]).toBe('MED001');
    expect(dataRow[headers.indexOf('Descrição')]).toBe('Medicamento');
    expect(dataRow[headers.indexOf('NCM')]).toBe('30049090');
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('200032');
    expect(dataRow[headers.indexOf('CST-IBS/CBS (Principal)')]).toBe('200');
  });

  it('processXmlFile: item com NCM desconhecido gera colunas tributárias vazias', async () => {
    const xml = buildNfeXml([
      { nItem: '1', cProd: 'X001', xProd: 'Produto desconhecido', NCM: '99999999', uCom: 'UN', qCom: '1', vProd: '50.00' },
    ]);

    const result = await service.processXmlFile(xml);
    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    const headers = rows[0] as string[];
    const dataRow = rows[1];
    expect(dataRow[headers.indexOf('cClassTrib (Principal)')]).toBe('');
    expect(dataRow[headers.indexOf('CST-IBS/CBS (Principal)')]).toBe('');
  });

  it('processXmlFile: múltiplos itens processados corretamente', async () => {
    const xml = buildNfeXml([
      { nItem: '1', cProd: 'A', xProd: 'Item A', NCM: '30049090', uCom: 'UN', qCom: '1', vProd: '10.00' },
      { nItem: '2', cProd: 'B', xProd: 'Item B', NCM: '99999999', uCom: 'KG', qCom: '2', vProd: '20.00' },
    ]);

    const result = await service.processXmlFile(xml);
    const wb = XLSX.read(result);
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as unknown as unknown[][];

    // Header + pelo menos 2 linhas de dados
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('processXmlFile: rejeita XML inválido', async () => {
    const invalid = Buffer.from('não é um xml válido <<<', 'utf-8');
    await expect(service.processXmlFile(invalid)).rejects.toThrow();
  });

  it('processXmlFile: rejeita XML sem itens det', async () => {
    const xml = Buffer.from('<nfeProc><NFe><infNFe></infNFe></NFe></nfeProc>', 'utf-8');
    await expect(service.processXmlFile(xml)).rejects.toThrow('Nenhum item (det) encontrado');
  });
});
