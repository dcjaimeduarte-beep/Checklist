import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import * as nodemailer from 'nodemailer';

import {
  AuditReportDto,
  CancelamentoItemDto,
  ConfrontResultDto,
} from '../confront/dto/confront-result.dto';

// ---------------------------------------------------------------------------
// Paleta de cores (ARGB)
// ---------------------------------------------------------------------------
const NAVY   = 'FF1E3A5F';
const WHITE  = 'FFFFFFFF';
const LBLUE  = 'FFE8EFF8';
const GREEN  = 'FFD5F5E3';
const YELLOW = 'FFFFF3CD';
const RED    = 'FFFDE8E8';
const GRAY   = 'FFF5F5F5';
const ORANGE = 'FFFFF0E0';
const PURPLE = 'FFF3E5FF';
const HEADER_BLUE = 'FFBFD7EE'; // seção header light blue

// ---------------------------------------------------------------------------
// Estrutura vazia para audit quando null/undefined
// ---------------------------------------------------------------------------
const EMPTY_AUDIT: AuditReportDto = {
  totalSpedCount: 0,
  totalXmlCount: 0,
  matchedCount: 0,
  totalSpedValue: 0,
  totalXmlValue: 0,
  totalValueDiff: 0,
  totalVlSpedMatched: 0,
  totalVlXmlMatched: 0,
  totalVlXmlNotInSped: 0,
  totalVlSpedNotInXml: 0,
  matchedWithValueDiff: [],
  verdict: 'ok',
  verdictMessages: [],
};

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  // =========================================================================
  // Excel
  // =========================================================================

  async generateExcel(data: ConfrontResultDto): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'AnaliseSped';
    wb.created = new Date();

    const audit = data.audit ?? EMPTY_AUDIT;
    const cancelamentos: CancelamentoItemDto[] = data.cancelamentos ?? [];

    this.buildResumoSheet(wb, data, audit, cancelamentos);
    this.buildAuditoriaSheet(wb, data, audit);
    this.buildXmlsNotInSpedSheet(wb, data, audit);
    this.buildSpedNotInXmlSheet(wb, data, audit);
    this.buildCfopAgrupadoSheet(wb, data);
    this.buildCancelamentosSheet(wb, cancelamentos);
    this.buildSemAutorizacaoSheet(wb, data);
    this.buildErrosLeituraSheet(wb, data);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // -------------------------------------------------------------------------
  // 1. Resumo
  // -------------------------------------------------------------------------
  private buildResumoSheet(
    wb: ExcelJS.Workbook,
    data: ConfrontResultDto,
    audit: AuditReportDto,
    cancelamentos: CancelamentoItemDto[],
  ) {
    const ws = wb.addWorksheet('Resumo');
    ws.columns = [{ width: 38 }, { width: 44 }];

    // Título
    this.addNavyRow(ws, ['CONFRONTO SPED x XML — RELATÓRIO FISCAL', ''], 2);
    ws.addRow([]);

    // Dados da empresa
    this.addSectionHeader(ws, 'DADOS DO CONTRIBUINTE', 2);
    const infoRows: [string, string | number][] = [
      ['Empresa', data.spedInfo.nome],
      ['CNPJ', data.spedInfo.cnpj],
      ['UF', data.spedInfo.uf],
      ['Período início', this.formatDate(data.spedInfo.dtIni)],
      ['Período fim', this.formatDate(data.spedInfo.dtFin)],
      ['Arquivo SPED', data.spedFilename],
      ['Data do confronto', new Date(data.createdAt).toLocaleString('pt-BR')],
      ['Filtro de emissão', this.filtroLabel(data.filtroEmissao)],
    ];
    for (const [label, value] of infoRows) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    }

    ws.addRow([]);

    // Auditoria — verdict
    this.addSectionHeader(ws, 'AUDITORIA FISCAL', 2);
    const verdictColor = this.verdictColor(audit.verdict);
    const verdictRow = ws.addRow(['Resultado', this.verdictLabel(audit.verdict)]);
    verdictRow.getCell(1).font = { bold: true };
    verdictRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verdictColor } };
    verdictRow.getCell(2).font = { bold: true };

    for (const msg of audit.verdictMessages) {
      const mr = ws.addRow(['', msg]);
      mr.getCell(2).font = { italic: true, color: { argb: 'FF555555' } };
    }

    ws.addRow([]);

    // Totais quantitativos
    this.addSectionHeader(ws, 'TOTAIS', 2);
    const totaisQty: [string, number][] = [
      ['Total de entradas no SPED', data.totalSpedEntries],
      ['Total de XMLs enviados', data.totalXmls],
      ['Documentos conferidos (OK)', data.totalMatches],
      ['XMLs não escriturados no SPED', data.xmlsNotInSped.length],
      ['SPED sem XML correspondente', data.spedNotInXml.length],
      ['XMLs sem autorização SEFAZ', data.totalSemAutorizacao],
      ['Cancelamentos processados', cancelamentos.length],
    ];
    for (const [label, value] of totaisQty) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      const isDivergencia =
        (label.includes('sem') || label.includes('não')) && value > 0;
      if (isDivergencia) {
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
        row.getCell(2).font = { bold: true, color: { argb: 'FFC0392B' } };
      }
    }

    ws.addRow([]);

    // Totais de valores — VL Operação C190 (referência fiscal principal)
    this.addSectionHeader(ws, 'VL OPERAÇÃO — C190 (Referência Fiscal)', 2);
    const db = data.dashboard;
    const vlOprC190         = db?.totalVlOprC190         ?? db?.cfopSummary?.reduce((s, c) => s + c.vlOpr, 0) ?? 0;
    const vlOprC190Entradas = db?.totalVlOprC190Entradas ?? db?.cfopSummary?.filter(c => ['1','2'].includes(c.cfop[0])).reduce((s, c) => s + c.vlOpr, 0) ?? 0;
    const vlOprC190Saidas   = db?.totalVlOprC190Saidas   ?? db?.cfopSummary?.filter(c => ['5','6'].includes(c.cfop[0])).reduce((s, c) => s + c.vlOpr, 0) ?? 0;

    const notaRow = ws.addRow(['* Total operacional escriturado no SPED (exclui frete, seguro e despesas acessórias)']);
    notaRow.getCell(1).font = { italic: true, color: { argb: 'FF555555' } };

    const vlOprRows: [string, number][] = [
      ['VL Operação Total (C190)',        vlOprC190],
      ['VL Operação — Entradas (1xxx/2xxx)', vlOprC190Entradas],
      ['VL Operação — Saídas (5xxx/6xxx)',   vlOprC190Saidas],
    ];
    for (const [label, value] of vlOprRows) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EFF8' } };
      this.setCurrency(row.getCell(2), value);
      row.getCell(2).font = { bold: true };
    }

    ws.addRow([]);

    // Totais de valores gerais
    this.addSectionHeader(ws, 'TOTAIS DE VALORES GERAIS (R$)', 2);
    const totaisVal: [string, number][] = [
      ['VL Total SPED — VL_DOC C100/D100', audit.totalSpedValue],
      ['VL Total XMLs — vNF', audit.totalXmlValue],
      ['VL SPED — pares casados', audit.totalVlSpedMatched],
      ['VL XML — pares casados', audit.totalVlXmlMatched],
      ['VL XMLs não no SPED', audit.totalVlXmlNotInSped],
      ['VL SPED sem XML', audit.totalVlSpedNotInXml],
      ['Diferença total (SPED − XML)', audit.totalValueDiff],
    ];
    for (const [label, value] of totaisVal) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      this.setCurrency(row.getCell(2), value);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Auditoria Fiscal (nova)
  // -------------------------------------------------------------------------
  private buildAuditoriaSheet(
    wb: ExcelJS.Workbook,
    _data: ConfrontResultDto,
    audit: AuditReportDto,
  ) {
    const ws = wb.addWorksheet('Auditoria Fiscal');

    // Verdict banner
    const verdictColor = this.verdictColor(audit.verdict);
    const bannerRow = ws.addRow([this.verdictLabel(audit.verdict)]);
    bannerRow.height = 28;
    const bannerCell = bannerRow.getCell(1);
    bannerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: verdictColor } };
    bannerCell.font = { bold: true, size: 14 };
    bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    ws.mergeCells(bannerRow.number, 1, bannerRow.number, 12);

    // Mensagens do verdict
    for (const msg of audit.verdictMessages) {
      const mr = ws.addRow([msg]);
      mr.getCell(1).font = { italic: true, color: { argb: 'FF444444' } };
      ws.mergeCells(mr.number, 1, mr.number, 12);
    }

    ws.addRow([]);

    // Decomposição de valores
    this.addSectionHeader(ws, 'DECOMPOSIÇÃO DE VALORES', 4);
    const decompHeaders = ws.addRow(['Categoria', 'Qtd', 'VL SPED R$', 'VL XML R$']);
    this.styleHeaderRow(decompHeaders, 4);

    const decompData: [string, number, number, number][] = [
      ['Pares casados (em ambos)', audit.matchedCount, audit.totalVlSpedMatched, audit.totalVlXmlMatched],
      ['XMLs extras (não no SPED)', _data.xmlsNotInSped.length, 0, audit.totalVlXmlNotInSped],
      ['SPED extras (sem XML)', _data.spedNotInXml.length, audit.totalVlSpedNotInXml, 0],
    ];
    decompData.forEach(([cat, qty, vlSped, vlXml], i) => {
      const row = ws.addRow([cat, qty, vlSped, vlXml]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LBLUE } };
      row.getCell(1).font = { bold: true };
      this.setCurrency(row.getCell(3), vlSped);
      this.setCurrency(row.getCell(4), vlXml);
    });

    ws.addRow([]);

    // Tabela de divergências de valor entre pares
    this.addSectionHeader(ws, 'DIVERGÊNCIAS DE VALOR ENTRE PARES CASADOS', 12);

    const headers = [
      'Chave', 'Registro', 'Nº Doc', 'Data Doc', 'Operação',
      'Nº NF', 'Emissão', 'CNPJ Emitente', 'Emitente',
      'VL SPED R$', 'VL XML R$', 'Diferença R$',
    ];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    ws.columns = [
      { width: 46 }, { width: 8 }, { width: 10 }, { width: 12 }, { width: 8 },
      { width: 10 }, { width: 12 }, { width: 18 }, { width: 32 },
      { width: 14 }, { width: 14 }, { width: 14 },
    ];

    const sorted = [...(audit.matchedWithValueDiff ?? [])].sort(
      (a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca),
    );

    if (sorted.length === 0) {
      const empty = ws.addRow(['Nenhuma divergência de valor entre pares casados.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
    }

    sorted.forEach((item, i) => {
      const row = ws.addRow([
        item.chave,
        item.registro,
        item.numDoc ?? '',
        item.dtDoc ? this.formatDate(item.dtDoc) : '',
        item.indOper === '0' ? 'Entrada' : 'Saída',
        item.nNF ?? '',
        item.dhEmi ? this.formatDhEmi(item.dhEmi) : '',
        item.cnpjEmit ?? '',
        item.xNomeEmit ?? '',
        item.vlSped,
        item.vlXml,
        item.diferenca,
      ]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LBLUE } };
      this.setCurrency(row.getCell(10), item.vlSped);
      this.setCurrency(row.getCell(11), item.vlXml);
      this.setCurrency(row.getCell(12), item.diferenca);
      // Destaque vermelho para diferença relevante
      if (Math.abs(item.diferenca) > 0.05) {
        row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
        row.getCell(12).font = { bold: true, color: { argb: 'FFC0392B' } };
      }
    });
  }

  // -------------------------------------------------------------------------
  // 3. XMLs não no SPED (atualizado com campos fiscais + TOTAL)
  // -------------------------------------------------------------------------
  private buildXmlsNotInSpedSheet(
    wb: ExcelJS.Workbook,
    data: ConfrontResultDto,
    audit: AuditReportDto,
  ) {
    const ws = wb.addWorksheet('XMLs não no SPED');

    ws.columns = [
      { width: 46 }, { width: 35 }, { width: 8 }, { width: 12 },
      { width: 8 }, { width: 22 }, { width: 18 }, { width: 35 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 },
    ];

    const headers = [
      'Chave de Acesso', 'Arquivo XML', 'Tipo', 'Nº NF/CT-e', 'Série',
      'Data Emissão', 'CNPJ Emitente', 'Razão Social',
      'CFOP(s)', 'VL NF R$', 'BC ICMS R$', 'VL ICMS R$',
      'BC ST R$', 'VL ICMS ST R$', 'VL IPI R$', 'VL PIS R$', 'VL COFINS R$',
    ];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    // Acumuladores para o TOTAL
    let sumVlNf = 0, sumVbc = 0, sumVicms = 0, sumVbcSt = 0;
    let sumVst = 0, sumVipi = 0, sumVpis = 0, sumVcofins = 0;

    data.xmlsNotInSped.forEach((item, i) => {
      const vlNf    = this.parseNum(item.vNF);
      const vBC     = this.parseNum(item.vBC);
      const vICMS   = this.parseNum(item.vICMS);
      const vBCST   = this.parseNum(item.vBCST);
      const vST     = this.parseNum(item.vST);
      const vIPI    = this.parseNum(item.vIPI);
      const vPIS    = this.parseNum(item.vPIS);
      const vCOFINS = this.parseNum(item.vCOFINS);

      sumVlNf    += vlNf;
      sumVbc     += vBC;
      sumVicms   += vICMS;
      sumVbcSt   += vBCST;
      sumVst     += vST;
      sumVipi    += vIPI;
      sumVpis    += vPIS;
      sumVcofins += vCOFINS;

      const row = ws.addRow([
        item.chave,
        item.filename,
        item.tipo,
        item.nNF ?? '',
        item.serie ?? '',
        this.formatDhEmi(item.dhEmi),
        item.cnpjEmit ?? '',
        item.xNomeEmit ?? '',
        item.cfops ?? '',
        vlNf, vBC, vICMS, vBCST, vST, vIPI, vPIS, vCOFINS,
      ]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LBLUE } };
      [10, 11, 12, 13, 14, 15, 16, 17].forEach((col) =>
        this.setCurrency(row.getCell(col), row.getCell(col).value as number),
      );
    });

    if (data.xmlsNotInSped.length === 0) {
      const empty = ws.addRow(['Nenhuma divergência encontrada — todos os XMLs estão no SPED.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
      return;
    }

    // Linha TOTAL
    const totalRow = ws.addRow([
      'TOTAL', '', '', '', '', '', '', '',
      '',
      sumVlNf, sumVbc, sumVicms, sumVbcSt, sumVst, sumVipi, sumVpis, sumVcofins,
    ]);
    totalRow.height = 20;
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      totalRow.getCell(c).font = { bold: true, color: { argb: WHITE } };
    }
    [10, 11, 12, 13, 14, 15, 16, 17].forEach((col) =>
      this.setCurrencyWhite(totalRow.getCell(col), totalRow.getCell(col).value as number),
    );

    // Não usar o valor do audit diretamente, mas registrá-lo para consistência
    void audit.totalVlXmlNotInSped;
  }

  // -------------------------------------------------------------------------
  // 4. SPED sem XML (atualizado com campos fiscais + TOTAL)
  // -------------------------------------------------------------------------
  private buildSpedNotInXmlSheet(
    wb: ExcelJS.Workbook,
    data: ConfrontResultDto,
    audit: AuditReportDto,
  ) {
    const ws = wb.addWorksheet('SPED sem XML');

    ws.columns = [
      { width: 46 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 12 },
      { width: 14 }, { width: 10 }, { width: 10 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
      { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 },
    ];

    const headers = [
      'Chave de Acesso', 'Registro', 'Modelo', 'Série', 'Nº Doc',
      'Data Documento', 'Situação', 'Operação',
      'VL DOC R$', 'BC ICMS R$', 'VL ICMS R$', 'BC ST R$',
      'VL ICMS ST R$', 'VL IPI R$', 'VL PIS R$', 'VL COFINS R$',
    ];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    let sumVlDoc = 0, sumVbc = 0, sumVicms = 0, sumVbcSt = 0;
    let sumVst = 0, sumVipi = 0, sumVpis = 0, sumVcofins = 0;

    data.spedNotInXml.forEach((item, i) => {
      const vlDoc   = item.vlDoc   ?? 0;
      const vBC     = item.vlBcIcms   ?? 0;
      const vICMS   = item.vlIcms     ?? 0;
      const vBCST   = item.vlBcIcmsSt ?? 0;
      const vST     = item.vlIcmsSt   ?? 0;
      const vIPI    = item.vlIpi      ?? 0;
      const vPIS    = item.vlPis      ?? 0;
      const vCOFINS = item.vlCofins   ?? 0;

      sumVlDoc   += vlDoc;
      sumVbc     += vBC;
      sumVicms   += vICMS;
      sumVbcSt   += vBCST;
      sumVst     += vST;
      sumVipi    += vIPI;
      sumVpis    += vPIS;
      sumVcofins += vCOFINS;

      const row = ws.addRow([
        item.chave,
        item.registro,
        this.modeloLabel(item.codMod),
        item.ser ?? '',
        item.numDoc ?? '',
        this.formatDate(item.dtDoc),
        this.situacaoLabel(item.codSit),
        item.indOper === '0' ? 'Entrada' : 'Saída',
        vlDoc, vBC, vICMS, vBCST, vST, vIPI, vPIS, vCOFINS,
      ]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LBLUE } };
      if (['02', '03', '04', '07'].includes(item.codSit ?? '')) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      }
      [9, 10, 11, 12, 13, 14, 15, 16].forEach((col) =>
        this.setCurrency(row.getCell(col), row.getCell(col).value as number),
      );
    });

    if (data.spedNotInXml.length === 0) {
      const empty = ws.addRow(['Nenhuma divergência encontrada — todos os registros SPED têm XML.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
      return;
    }

    // Linha TOTAL
    const totalRow = ws.addRow([
      'TOTAL', '', '', '', '', '', '', '',
      sumVlDoc, sumVbc, sumVicms, sumVbcSt, sumVst, sumVipi, sumVpis, sumVcofins,
    ]);
    totalRow.height = 20;
    for (let c = 1; c <= headers.length; c++) {
      totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      totalRow.getCell(c).font = { bold: true, color: { argb: WHITE } };
    }
    [9, 10, 11, 12, 13, 14, 15, 16].forEach((col) =>
      this.setCurrencyWhite(totalRow.getCell(col), totalRow.getCell(col).value as number),
    );

    void audit.totalVlSpedNotInXml;
  }

  // -------------------------------------------------------------------------
  // 5. CFOP Agrupado — C190 (nova)
  // -------------------------------------------------------------------------
  private buildCfopAgrupadoSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('CFOP Agrupado — C190');

    ws.columns = [
      { width: 10 }, { width: 12 }, { width: 12 },
      { width: 16 }, { width: 16 }, { width: 16 },
      { width: 16 }, { width: 16 },
    ];

    const allCfops = data.dashboard?.cfopSummary ?? [];

    const entradas = allCfops.filter((c) => ['1', '2'].includes(c.cfop?.[0] ?? ''));
    const saidas   = allCfops.filter((c) => ['5', '6'].includes(c.cfop?.[0] ?? ''));
    const outros   = allCfops.filter(
      (c) => !['1', '2', '5', '6'].includes(c.cfop?.[0] ?? ''),
    );

    const colHeaders = [
      'CFOP', 'CST ICMS', 'Alíq ICMS %',
      'BC ICMS R$', 'VL ICMS R$', 'BC ST R$', 'VL ICMS ST R$', 'VL OPR R$',
    ];

    const writeSection = (
      title: string,
      rows: typeof allCfops,
      argb: string,
    ) => {
      if (rows.length === 0) return;

      this.addSectionHeader(ws, title, 8);
      const hr = ws.addRow(colHeaders);
      this.styleHeaderRow(hr, colHeaders.length);

      let sVlBcIcms = 0, sVlIcms = 0, sVlBcSt = 0, sVlSt = 0, sVlOpr = 0;

      rows.forEach((c, i) => {
        sVlBcIcms += c.vlBcIcms;
        sVlIcms   += c.vlIcms;
        sVlBcSt   += c.vlBcIcmsSt;
        sVlSt     += c.vlIcmsSt;
        sVlOpr    += c.vlOpr;

        const row = ws.addRow([
          c.cfop, c.cstIcms, c.aliqIcms,
          c.vlBcIcms, c.vlIcms, c.vlBcIcmsSt, c.vlIcmsSt, c.vlOpr,
        ]);
        if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } };
        [4, 5, 6, 7, 8].forEach((col) =>
          this.setCurrency(row.getCell(col), row.getCell(col).value as number),
        );
        row.getCell(3).numFmt = '0.00';
      });

      // Subtotal por seção
      const sub = ws.addRow([
        'Subtotal', '', '',
        sVlBcIcms, sVlIcms, sVlBcSt, sVlSt, sVlOpr,
      ]);
      sub.height = 18;
      for (let c = 1; c <= 8; c++) {
        sub.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        sub.getCell(c).font = { bold: true };
      }
      [4, 5, 6, 7, 8].forEach((col) =>
        this.setCurrency(sub.getCell(col), sub.getCell(col).value as number),
      );

      ws.addRow([]);
    };

    writeSection('ENTRADAS (CFOPs 1xxx/2xxx)', entradas, LBLUE);
    writeSection('SAÍDAS (CFOPs 5xxx/6xxx)', saidas, GREEN);
    if (outros.length > 0) {
      writeSection('OUTROS CFOPs', outros, ORANGE);
    }

    if (allCfops.length === 0) {
      const empty = ws.addRow(['Sem dados de CFOP disponíveis (C190 não encontrado no SPED).']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
      return;
    }

    // Grand total
    const allRows = [...entradas, ...saidas, ...outros];
    const gt = allRows.reduce(
      (acc, c) => {
        acc.vlBcIcms   += c.vlBcIcms;
        acc.vlIcms     += c.vlIcms;
        acc.vlBcIcmsSt += c.vlBcIcmsSt;
        acc.vlIcmsSt   += c.vlIcmsSt;
        acc.vlOpr      += c.vlOpr;
        return acc;
      },
      { vlBcIcms: 0, vlIcms: 0, vlBcIcmsSt: 0, vlIcmsSt: 0, vlOpr: 0 },
    );

    const grandRow = ws.addRow([
      'TOTAL GERAL', '', '',
      gt.vlBcIcms, gt.vlIcms, gt.vlBcIcmsSt, gt.vlIcmsSt, gt.vlOpr,
    ]);
    grandRow.height = 22;
    for (let c = 1; c <= 8; c++) {
      grandRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      grandRow.getCell(c).font = { bold: true, color: { argb: WHITE }, size: 11 };
    }
    [4, 5, 6, 7, 8].forEach((col) =>
      this.setCurrencyWhite(grandRow.getCell(col), grandRow.getCell(col).value as number),
    );
  }

  // -------------------------------------------------------------------------
  // 6. Cancelamentos (nova)
  // -------------------------------------------------------------------------
  private buildCancelamentosSheet(
    wb: ExcelJS.Workbook,
    cancelamentos: CancelamentoItemDto[],
  ) {
    const ws = wb.addWorksheet('Cancelamentos');

    ws.columns = [
      { width: 24 }, { width: 46 }, { width: 35 }, { width: 10 },
      { width: 22 }, { width: 10 }, { width: 45 }, { width: 40 },
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 10 },
    ];

    const headers = [
      'Situação', 'Chave', 'Arquivo Evento', 'Nº NF',
      'Data Cancelamento', 'cStat Evento', 'Motivo SEFAZ', 'Justificativa (xJust)',
      'No SPED', 'COD_SIT SPED', 'VL DOC SPED R$', 'Registro SPED',
    ];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    if (cancelamentos.length === 0) {
      const empty = ws.addRow(['Nenhum evento de cancelamento processado.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
      return;
    }

    cancelamentos.forEach((item, i) => {
      const situacaoText = this.cancelamentoSituacaoLabel(item.situacao);
      const situacaoColor = this.cancelamentoSituacaoColor(item.situacao);

      const row = ws.addRow([
        situacaoText,
        item.chave,
        item.filename,
        item.nNF,
        item.dhCancelamento ? this.formatDhEmi(item.dhCancelamento) : '',
        item.cStatEvento,
        item.xMotivoEvento,
        item.xJust ?? '',
        item.noSped ? 'Sim' : 'Não',
        item.codSitSped ? this.situacaoLabel(item.codSitSped) : '',
        item.vlDocSped ?? 0,
        item.registroSped ?? '',
      ]);

      // Fundo alternado padrão
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };

      // Cor da célula de situação
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: situacaoColor } };
      row.getCell(1).font = { bold: true };

      // Destaque vermelho para "atencao"
      if (item.situacao === 'atencao') {
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
        row.getCell(9).font = { bold: true, color: { argb: 'FFC0392B' } };
      }

      if (item.vlDocSped !== undefined && item.vlDocSped !== null) {
        this.setCurrency(row.getCell(11), item.vlDocSped);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 7. Sem Autorização SEFAZ (mantida)
  // -------------------------------------------------------------------------
  private buildSemAutorizacaoSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('Sem Autorização SEFAZ');

    const headers = [
      'Chave de Acesso', 'Arquivo XML', 'Tipo', 'Nº NF/CT-e',
      'Série', 'Data Emissão', 'CNPJ Emitente', 'Razão Social',
      'cStat', 'Motivo SEFAZ', 'Dt Recebimento',
    ];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    ws.columns = [
      { width: 46 }, { width: 35 }, { width: 8 }, { width: 12 },
      { width: 8 }, { width: 22 }, { width: 18 }, { width: 35 },
      { width: 8 }, { width: 45 }, { width: 22 },
    ];

    const items = data.xmlsSemAutorizacao ?? [];
    items.forEach((item, i) => {
      const row = ws.addRow([
        item.chave,
        item.filename,
        item.tipo,
        item.nNF ?? '',
        item.serie ?? '',
        this.formatDhEmi(item.dhEmi),
        item.cnpjEmit ?? '',
        item.xNomeEmit ?? '',
        item.cStat ?? 'S/N',
        item.xMotivo ?? 'Sem protocolo de autorização',
        item.dhRecbto ? this.formatDhEmi(item.dhRecbto) : '',
      ]);
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RED } };
      }
    });

    if (items.length === 0) {
      const empty = ws.addRow(['Todos os XMLs possuem autorização SEFAZ.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
    }
  }

  // -------------------------------------------------------------------------
  // 8. Erros de Leitura (nova)
  // -------------------------------------------------------------------------
  private buildErrosLeituraSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('Erros de Leitura');

    ws.columns = [{ width: 50 }, { width: 80 }];

    // Nota explicativa
    const nota = ws.addRow([
      'ATENÇÃO: Os arquivos abaixo não puderam ser lidos/interpretados e foram ignorados no confronto.',
    ]);
    nota.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
    nota.getCell(1).font = { bold: true, color: { argb: 'FF856404' } };
    ws.mergeCells(nota.number, 1, nota.number, 2);

    ws.addRow([]);

    const headers = ['Arquivo', 'Motivo do Erro'];
    const hr = ws.addRow(headers);
    this.styleHeaderRow(hr, headers.length);

    const errors = data.xmlErrors ?? [];

    if (errors.length === 0) {
      const empty = ws.addRow(['Nenhum erro de leitura registrado.']);
      empty.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
      return;
    }

    errors.forEach((err, i) => {
      const row = ws.addRow([err.filename, err.reason]);
      if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
    });
  }

  // =========================================================================
  // PDF (estruturado — documento sumário)
  // =========================================================================

  async generatePdf(data: ConfrontResultDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const audit = data.audit ?? EMPTY_AUDIT;
      const cancelamentos: CancelamentoItemDto[] = data.cancelamentos ?? [];
      const navy  = '#1E3A5F';
      const pw    = doc.page.width - 80; // largura útil

      // -----------------------------------------------------------------
      // 1. Cabeçalho navy: empresa + CNPJ + período
      // -----------------------------------------------------------------
      doc.rect(40, 40, pw, 56).fill(navy);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
        .text(data.spedInfo.nome, 52, 50, { width: pw - 24 });
      doc.fontSize(9).font('Helvetica')
        .text(
          `CNPJ: ${data.spedInfo.cnpj}  |  UF: ${data.spedInfo.uf}  |  Período: ${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`,
          52,
          doc.y + 2,
          { width: pw - 24 },
        );
      doc.fillColor('black').moveDown(2);

      // -----------------------------------------------------------------
      // 2. Dados do Confronto
      // -----------------------------------------------------------------
      this.pdfSectionTitle(doc, 'DADOS DO CONFRONTO', navy);
      const infoRows: [string, string][] = [
        ['Empresa',          data.spedInfo.nome],
        ['UF',               data.spedInfo.uf],
        ['Arquivo SPED',     data.spedFilename],
        ['Data do confronto', new Date(data.createdAt).toLocaleString('pt-BR')],
        ['Filtro aplicado',  this.filtroLabel(data.filtroEmissao)],
      ];
      this.pdfLabelValueTable(doc, infoRows, pw);
      doc.moveDown(0.6);

      // -----------------------------------------------------------------
      // 3. Verdict banner
      // -----------------------------------------------------------------
      const verdictBg  = this.verdictColorHex(audit.verdict);
      const verdictTxt = audit.verdict === 'ok' ? '#155724' :
                         audit.verdict === 'atencao' ? '#856404' : '#721c24';
      const bannerY = doc.y;
      doc.rect(40, bannerY, pw, 28).fill(verdictBg);
      doc.fillColor(verdictTxt).font('Helvetica-Bold').fontSize(12)
        .text(
          `Auditoria Fiscal: ${this.verdictLabel(audit.verdict)}`,
          52, bannerY + 7, { width: pw - 24 },
        );
      doc.fillColor('black').moveDown(0.3);

      for (const msg of audit.verdictMessages) {
        doc.font('Helvetica').fontSize(8).fillColor('#444444')
          .text(`• ${msg}`, 52, doc.y, { width: pw - 24 });
      }
      doc.fillColor('black').moveDown(0.8);

      // -----------------------------------------------------------------
      // 4. Tabela de resumo (2 colunas: label / valor)
      // -----------------------------------------------------------------
      this.pdfSectionTitle(doc, 'RESUMO DO CONFRONTO', navy);
      const resumoRows: [string, string][] = [
        ['Total de entradas no SPED',       String(data.totalSpedEntries)],
        ['Total de XMLs enviados',           String(data.totalXmls)],
        ['Documentos conferidos (OK)',        String(data.totalMatches)],
        ['XMLs não escriturados no SPED',    String(data.xmlsNotInSped.length)],
        ['SPED sem XML correspondente',      String(data.spedNotInXml.length)],
        ['XMLs sem autorização SEFAZ',       String(data.totalSemAutorizacao)],
        ['Cancelamentos processados',        String(cancelamentos.length)],
        ['VL Total SPED (geral)',            `R$ ${this.brl(audit.totalSpedValue)}`],
        ['VL Total XMLs (geral)',            `R$ ${this.brl(audit.totalXmlValue)}`],
        ['Diferença total (SPED − XML)',     `R$ ${this.brl(audit.totalValueDiff)}`],
      ];
      this.pdfLabelValueTable(doc, resumoRows, pw);
      doc.moveDown(0.6);

      // -----------------------------------------------------------------
      // 5. Decomposição de valores (3 colunas)
      // -----------------------------------------------------------------
      this.pdfSectionTitle(doc, 'DECOMPOSIÇÃO DE VALORES', navy);
      this.pdfSimpleTable(
        doc,
        ['Categoria', 'VL SPED R$', 'VL XML R$'],
        [
          ['Pares casados',       `R$ ${this.brl(audit.totalVlSpedMatched)}`, `R$ ${this.brl(audit.totalVlXmlMatched)}`],
          ['XMLs extras',         'R$ 0,00',                                   `R$ ${this.brl(audit.totalVlXmlNotInSped)}`],
          ['SPED extras',         `R$ ${this.brl(audit.totalVlSpedNotInXml)}`, 'R$ 0,00'],
        ],
        pw,
        navy,
        [pw * 0.5, pw * 0.25, pw * 0.25],
      );
      doc.moveDown(0.6);

      // -----------------------------------------------------------------
      // 6. CFOP Agrupado (top 15)
      // -----------------------------------------------------------------
      const cfopRows = data.dashboard?.cfopSummary ?? [];
      if (cfopRows.length > 0) {
        if (doc.y > doc.page.height - 180) doc.addPage();
        this.pdfSectionTitle(doc, 'CFOP AGRUPADO — C190', navy);
        const cfopDisplay = cfopRows.slice(0, 15);
        this.pdfSimpleTable(
          doc,
          ['CFOP', 'CST', 'Alíq%', 'BC ICMS', 'VL ICMS', 'BC ST', 'VL ST'],
          cfopDisplay.map((c) => [
            c.cfop, c.cstIcms, String(c.aliqIcms),
            `R$ ${this.brl(c.vlBcIcms)}`, `R$ ${this.brl(c.vlIcms)}`,
            `R$ ${this.brl(c.vlBcIcmsSt)}`, `R$ ${this.brl(c.vlIcmsSt)}`,
          ]),
          pw,
          navy,
          [pw * 0.08, pw * 0.08, pw * 0.07, pw * 0.19, pw * 0.19, pw * 0.19, pw * 0.20],
        );
        if (cfopRows.length > 15) {
          doc.fontSize(7).fillColor('#888')
            .text(`... e mais ${cfopRows.length - 15} CFOPs. Veja o Excel para lista completa.`);
          doc.fillColor('black');
        }
        doc.moveDown(0.6);
      }

      // -----------------------------------------------------------------
      // 7. Divergências de valor entre pares (até 20)
      // -----------------------------------------------------------------
      const diffs = [...(audit.matchedWithValueDiff ?? [])].sort(
        (a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca),
      );
      if (diffs.length > 0) {
        if (doc.y > doc.page.height - 160) doc.addPage();
        this.pdfSectionTitle(doc, `DIVERGÊNCIAS DE VALOR ENTRE PARES (${diffs.length})`, navy);
        this.pdfSimpleTable(
          doc,
          ['Nº Doc', 'Data', 'Emitente', 'VL SPED', 'VL XML', 'Diferença'],
          diffs.slice(0, 20).map((d) => [
            d.numDoc ?? d.nNF ?? '',
            d.dtDoc ? this.formatDate(d.dtDoc) : this.formatDhEmi(d.dhEmi),
            this.truncate(d.xNomeEmit ?? d.cnpjEmit ?? '', 28),
            `R$ ${this.brl(d.vlSped)}`,
            `R$ ${this.brl(d.vlXml)}`,
            `R$ ${this.brl(d.diferenca)}`,
          ]),
          pw,
          navy,
          [pw * 0.10, pw * 0.10, pw * 0.28, pw * 0.17, pw * 0.17, pw * 0.18],
        );
        if (diffs.length > 20) {
          doc.fontSize(7).fillColor('#888')
            .text(`... e mais ${diffs.length - 20} registros. Veja o Excel para lista completa.`);
          doc.fillColor('black');
        }
        doc.moveDown(0.6);
      }

      // -----------------------------------------------------------------
      // 8. XMLs não no SPED (até 30)
      // -----------------------------------------------------------------
      if (doc.y > doc.page.height - 160) doc.addPage();
      this.pdfSectionTitle(doc, `XMLs NÃO NO SPED (${data.xmlsNotInSped.length})`, navy);
      if (data.xmlsNotInSped.length === 0) {
        doc.font('Helvetica').fontSize(8).fillColor('#27AE60')
          .text('Nenhuma divergência — todos os XMLs estão escriturados.');
        doc.fillColor('black');
      } else {
        this.pdfSimpleTable(
          doc,
          ['Nº NF', 'Data', 'CNPJ', 'Emitente', 'VL NF'],
          data.xmlsNotInSped.slice(0, 30).map((x) => [
            x.nNF ?? '',
            this.formatDhEmi(x.dhEmi),
            x.cnpjEmit ?? '',
            this.truncate(x.xNomeEmit ?? '', 30),
            `R$ ${this.brl(this.parseNum(x.vNF))}`,
          ]),
          pw,
          navy,
          [pw * 0.10, pw * 0.12, pw * 0.18, pw * 0.44, pw * 0.16],
        );
        if (data.xmlsNotInSped.length > 30) {
          doc.fontSize(7).fillColor('#888')
            .text(`... e mais ${data.xmlsNotInSped.length - 30} registros. Veja o Excel.`);
          doc.fillColor('black');
        }
      }
      doc.moveDown(0.6);

      // -----------------------------------------------------------------
      // 9. SPED sem XML (até 30)
      // -----------------------------------------------------------------
      if (doc.y > doc.page.height - 160) doc.addPage();
      this.pdfSectionTitle(doc, `SPED SEM XML (${data.spedNotInXml.length})`, navy);
      if (data.spedNotInXml.length === 0) {
        doc.font('Helvetica').fontSize(8).fillColor('#27AE60')
          .text('Nenhuma divergência — todos os registros têm XML.');
        doc.fillColor('black');
      } else {
        this.pdfSimpleTable(
          doc,
          ['Nº Doc', 'Data', 'Modelo', 'Situação', 'VL DOC'],
          data.spedNotInXml.slice(0, 30).map((x) => [
            x.numDoc ?? '',
            this.formatDate(x.dtDoc),
            this.modeloLabel(x.codMod),
            this.situacaoLabel(x.codSit),
            `R$ ${this.brl(x.vlDoc ?? 0)}`,
          ]),
          pw,
          navy,
          [pw * 0.14, pw * 0.14, pw * 0.14, pw * 0.42, pw * 0.16],
        );
        if (data.spedNotInXml.length > 30) {
          doc.fontSize(7).fillColor('#888')
            .text(`... e mais ${data.spedNotInXml.length - 30} registros. Veja o Excel.`);
          doc.fillColor('black');
        }
      }
      doc.moveDown(0.6);

      // -----------------------------------------------------------------
      // 10. Cancelamentos (todos)
      // -----------------------------------------------------------------
      if (cancelamentos.length > 0) {
        if (doc.y > doc.page.height - 160) doc.addPage();
        this.pdfSectionTitle(doc, `CANCELAMENTOS (${cancelamentos.length})`, navy);
        this.pdfSimpleTable(
          doc,
          ['Situação', 'Nº NF', 'Data', 'SPED COD_SIT', 'VL DOC SPED'],
          cancelamentos.map((c) => [
            this.cancelamentoSituacaoLabel(c.situacao),
            c.nNF,
            c.dhCancelamento ? this.formatDhEmi(c.dhCancelamento) : '',
            c.codSitSped ? this.situacaoLabel(c.codSitSped) : '—',
            `R$ ${this.brl(c.vlDocSped ?? 0)}`,
          ]),
          pw,
          navy,
          [pw * 0.28, pw * 0.12, pw * 0.14, pw * 0.28, pw * 0.18],
        );
        doc.moveDown(0.6);
      }

      // -----------------------------------------------------------------
      // 11. Rodapé
      // -----------------------------------------------------------------
      doc.moveDown(1)
        .fontSize(7)
        .fillColor('#888888')
        .text(
          `Gerado em ${new Date().toLocaleString('pt-BR')} pelo sistema AnaliseSped`,
          { align: 'center' },
        );

      doc.end();
    });
  }

  // =========================================================================
  // Helpers PDF
  // =========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pdfSectionTitle(doc: any, title: string, navy: string) {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(navy).text(title);
    doc.fillColor('black').font('Helvetica').fontSize(8).moveDown(0.2);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pdfLabelValueTable(doc: any, rows: [string, string][], pw: number) {
    const col1 = pw * 0.38;
    const col2 = pw * 0.62;
    rows.forEach(([label, value], i) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(40, rowY, pw, 12).fill('#E8EFF8');
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8)
        .text(label, 44, rowY + 2, { width: col1 - 8, lineBreak: false });
      doc.font('Helvetica').fontSize(8)
        .text(value, 44 + col1, rowY + 2, { width: col2 - 8, lineBreak: false });
      doc.moveDown(0.6);
    });
  }

  private pdfSimpleTable(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    headers: string[],
    rows: string[][],
    pw: number,
    navy: string,
    colWidths?: number[],
  ) {
    const widths = colWidths ?? headers.map(() => pw / headers.length);

    // Cabeçalho
    const hY = doc.y;
    doc.rect(40, hY, pw, 14).fill(navy);
    let hx = 40;
    headers.forEach((h, i) => {
      doc.fillColor('white').font('Helvetica-Bold').fontSize(7)
        .text(h, hx + 2, hY + 3, { width: widths[i] - 4, lineBreak: false });
      hx += widths[i];
    });
    doc.fillColor('black').moveDown(0.2);

    // Linhas
    rows.forEach((row, ri) => {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const rowY = doc.y;
      if (ri % 2 === 0) doc.rect(40, rowY, pw, 11).fill('#E8EFF8');
      let rx = 40;
      row.forEach((cell, ci) => {
        doc.fillColor('black').font('Helvetica').fontSize(7)
          .text(String(cell), rx + 2, rowY + 2, { width: widths[ci] - 4, lineBreak: false });
        rx += widths[ci];
      });
      doc.moveDown(0.55);
    });

    if (rows.length === 0) {
      doc.font('Helvetica').fontSize(7).fillColor('#27AE60')
        .text('Sem registros.');
      doc.fillColor('black');
    }
  }

  // =========================================================================
  // E-mail
  // =========================================================================

  async sendEmail(
    data: ConfrontResultDto,
    to: string,
    message?: string,
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const excelBuffer = await this.generateExcel(data);
    const pdfBuffer   = await this.generatePdf(data);
    const periodo     = `${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`;
    const baseFilename = this.buildFilename(data.spedInfo.nome, data.spedInfo.dtIni);

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: `Confronto SPED x XML — ${data.spedInfo.nome} — ${periodo}`,
      html: this.buildEmailHtml(data, message),
      attachments: [
        {
          filename: `${baseFilename}.xlsx`,
          content: excelBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        {
          filename: `${baseFilename}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    this.logger.log(`E-mail enviado para ${to}`);
  }

  private buildEmailHtml(data: ConfrontResultDto, message?: string): string {
    const audit   = data.audit ?? EMPTY_AUDIT;
    const periodo = `${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 620px;">
        <div style="background: #1e3a5f; padding: 20px; color: white;">
          <h2 style="margin:0">Confronto SPED x XML — Relatório Fiscal</h2>
          <p style="margin:4px 0 0; font-size:13px;">${data.spedInfo.nome} | CNPJ: ${data.spedInfo.cnpj} | ${periodo}</p>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          ${message ? `<p style="border-left: 4px solid #1e3a5f; padding-left: 12px; color: #333;">${message}</p>` : ''}
          <table style="width:100%; border-collapse: collapse; margin-top: 12px; font-size: 13px;">
            <tr><td style="font-weight:bold; padding: 4px 8px;">Entradas SPED</td><td>${data.totalSpedEntries}</td></tr>
            <tr style="background:#eef;"><td style="font-weight:bold; padding: 4px 8px;">XMLs enviados</td><td>${data.totalXmls}</td></tr>
            <tr><td style="font-weight:bold; padding: 4px 8px;">Conferidos (OK)</td><td>${data.totalMatches}</td></tr>
            <tr style="${data.xmlsNotInSped.length > 0 ? 'background:#fde8e8;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">XMLs não no SPED</td><td><strong>${data.xmlsNotInSped.length}</strong></td></tr>
            <tr style="${data.spedNotInXml.length > 0 ? 'background:#fde8e8;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">SPED sem XML</td><td><strong>${data.spedNotInXml.length}</strong></td></tr>
            <tr style="${data.totalSemAutorizacao > 0 ? 'background:#fde8e8;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">Sem autorização SEFAZ</td><td><strong>${data.totalSemAutorizacao}</strong></td></tr>
            <tr style="background:#eef;"><td style="font-weight:bold; padding: 4px 8px;">VL Total SPED</td><td>R$ ${this.brl(audit.totalSpedValue)}</td></tr>
            <tr><td style="font-weight:bold; padding: 4px 8px;">VL Total XMLs</td><td>R$ ${this.brl(audit.totalXmlValue)}</td></tr>
            <tr style="${Math.abs(audit.totalValueDiff) > 0.01 ? 'background:#fff3cd;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">Diferença total</td><td>R$ ${this.brl(audit.totalValueDiff)}</td></tr>
          </table>
          <p style="margin-top: 20px; color: #666; font-size: 11px;">
            Relatório em anexo (Excel + PDF). Gerado em ${new Date().toLocaleString('pt-BR')} pelo sistema AnaliseSped.
          </p>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // Helpers Excel compartilhados
  // =========================================================================

  /** Linha navy com texto branco bold (título / header global) */
  private addNavyRow(ws: ExcelJS.Worksheet, values: (string | number)[], colSpan: number) {
    const row = ws.addRow(values);
    row.height = 22;
    for (let i = 1; i <= colSpan; i++) {
      const cell = row.getCell(i);
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font  = { bold: true, color: { argb: WHITE }, size: 11 };
      cell.alignment = { vertical: 'middle' };
    }
  }

  /** Linha azul clara com texto escuro bold — separador de seção */
  private addSectionHeader(ws: ExcelJS.Worksheet, title: string, colSpan: number) {
    const row = ws.addRow([title]);
    row.height = 18;
    ws.mergeCells(row.number, 1, row.number, colSpan);
    const cell = row.getCell(1);
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.font  = { bold: true, color: { argb: 'FF1A2F4A' }, size: 10 };
    cell.alignment = { vertical: 'middle' };
  }

  /** Linha de cabeçalho de tabela: navy médio com texto branco */
  private styleHeaderRow(row: ExcelJS.Row, colCount: number) {
    row.height = 18;
    for (let i = 1; i <= colCount; i++) {
      const cell = row.getCell(i);
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font  = { bold: true, color: { argb: WHITE }, size: 9 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    }
  }

  /** Define valor numérico como moeda BRL */
  private setCurrency(cell: ExcelJS.Cell, value: number) {
    cell.value     = Number(value) || 0;
    cell.numFmt    = '#,##0.00';
    cell.alignment = { horizontal: 'right' };
  }

  /** Define valor numérico como moeda BRL com fonte branca (linha TOTAL navy) */
  private setCurrencyWhite(cell: ExcelJS.Cell, value: number) {
    this.setCurrency(cell, value);
    cell.font = { bold: true, color: { argb: WHITE } };
  }

  // =========================================================================
  // Utilitários gerais
  // =========================================================================

  private brl(v: number): string {
    return (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private parseNum(s?: string | number | null): number {
    if (s === null || s === undefined || s === '') return 0;
    return Number(String(s).replace(',', '.')) || 0;
  }

  /** Gera nome base do arquivo: {NomeEmpresa}_{MM-AAAA} */
  private buildFilename(nome: string, dtIni: string): string {
    const nomeSanitizado = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // remove acentos
      .replace(/[^a-zA-Z0-9\s]/g, '')    // remove caracteres especiais
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const mes = dtIni.length >= 8 ? `${dtIni.slice(2, 4)}-${dtIni.slice(4, 8)}` : dtIni;
    return `${nomeSanitizado}_${mes}`;
  }

  private formatDate(dt?: string): string {
    if (!dt || dt.length < 8) return dt ?? '';
    // DDMMAAAA → DD/MM/AAAA
    return `${dt.slice(0, 2)}/${dt.slice(2, 4)}/${dt.slice(4, 8)}`;
  }

  private formatDhEmi(dh?: string): string {
    if (!dh) return '';
    if (dh.includes('T') || dh.includes('-')) {
      return new Date(dh).toLocaleDateString('pt-BR');
    }
    return this.formatDate(dh);
  }

  private modeloLabel(mod?: string): string {
    const map: Record<string, string> = { '55': 'NF-e', '65': 'NFC-e', '57': 'CT-e', '67': 'CT-e OS' };
    return map[mod ?? ''] ?? mod ?? '';
  }

  private situacaoLabel(sit?: string): string {
    const map: Record<string, string> = {
      '00': 'Regular',
      '01': 'Regular (ext.)',
      '02': 'Cancelada',
      '03': 'Cancelada (ext.)',
      '04': 'Denegada',
      '06': 'Complementar',
      '07': 'Canc. Ext.',
      '08': 'Devolução',
    };
    return map[sit ?? ''] ?? sit ?? '';
  }

  private filtroLabel(filtro?: string): string {
    const map: Record<string, string> = {
      todas:     'Todas (próprias + terceiros)',
      proprias:  'Apenas emissão própria',
      terceiros: 'Apenas terceiros',
    };
    return map[filtro ?? 'todas'] ?? filtro ?? 'Todas';
  }

  private verdictLabel(verdict?: string): string {
    const map: Record<string, string> = {
      ok:          'OK — Sem divergências relevantes',
      atencao:     'ATENÇÃO — Divergências encontradas',
      divergencia: 'DIVERGÊNCIA — Inconsistências fiscais graves',
    };
    return map[verdict ?? 'ok'] ?? verdict ?? 'OK';
  }

  /** ARGB para Excel */
  private verdictColor(verdict?: string): string {
    if (verdict === 'ok')          return GREEN;
    if (verdict === 'atencao')     return YELLOW;
    if (verdict === 'divergencia') return RED;
    return GRAY;
  }

  /** Hex para PDF */
  private verdictColorHex(verdict?: string): string {
    if (verdict === 'ok')          return '#D5F5E3';
    if (verdict === 'atencao')     return '#FFF3CD';
    if (verdict === 'divergencia') return '#FDE8E8';
    return '#F5F5F5';
  }

  private cancelamentoSituacaoLabel(sit: 'ok' | 'atencao' | 'info'): string {
    if (sit === 'ok')      return 'Cancelado em ambos';
    if (sit === 'atencao') return 'ATIVO NO SPED!';
    return 'Não escriturada';
  }

  /** ARGB para Excel */
  private cancelamentoSituacaoColor(sit: 'ok' | 'atencao' | 'info'): string {
    if (sit === 'ok')      return GREEN;
    if (sit === 'atencao') return RED;
    return GRAY;
  }

  private truncate(s: string, n: number): string {
    return s && s.length > n ? s.slice(0, n) : (s ?? '');
  }

  // Referência para suprimir lint warnings de constantes usadas apenas para paleta
  private _unusedPaletteRef = [PURPLE, ORANGE];
}
