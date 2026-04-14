import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import * as nodemailer from 'nodemailer';

import { ConfrontResultDto } from '../confront/dto/confront-result.dto';

const NAVY = 'FF1E3A5F';
const WHITE = 'FFFFFFFF';
const LIGHT_BLUE = 'FFE8EFF8';
const YELLOW = 'FFFFF3CD';
const RED_LIGHT = 'FFFDE8E8';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  // ------------------------------------------------------------------
  // Excel
  // ------------------------------------------------------------------

  async generateExcel(data: ConfrontResultDto): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'AnaliseSped';
    wb.created = new Date();

    this.buildResumoSheet(wb, data);
    this.buildXmlsNotInSpedSheet(wb, data);
    this.buildSpedNotInXmlSheet(wb, data);

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private buildResumoSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('Resumo');
    ws.columns = [{ width: 30 }, { width: 40 }];

    this.addNavyRow(ws, ['CONFRONTO SPED x XML — RELATÓRIO FISCAL', ''], 2);

    ws.addRow([]);

    const rows = [
      ['Empresa', data.spedInfo.nome],
      ['CNPJ', data.spedInfo.cnpj],
      ['UF', data.spedInfo.uf],
      ['Período início', this.formatDate(data.spedInfo.dtIni)],
      ['Período fim', this.formatDate(data.spedInfo.dtFin)],
      ['Arquivo SPED', data.spedFilename],
      ['Data do confronto', new Date(data.createdAt).toLocaleString('pt-BR')],
    ];

    for (const [label, value] of rows) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
    }

    ws.addRow([]);
    this.addNavyRow(ws, ['TOTAIS', ''], 2);

    const totais = [
      ['Total de entradas no SPED', data.totalSpedEntries],
      ['Total de XMLs enviados', data.totalXmls],
      ['Documentos conferidos (OK)', data.totalMatches],
      ['XMLs não escriturados no SPED', data.xmlsNotInSped.length],
      ['SPED sem XML correspondente', data.spedNotInXml.length],
    ];

    for (const [label, value] of totais) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      if (Number(value) > 0 && String(label).includes('sem') || String(label).includes('não')) {
        row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
        row.getCell(2).font = { bold: true, color: { argb: 'FFC0392B' } };
      }
    }
  }

  private buildXmlsNotInSpedSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('XMLs não no SPED');

    const headers = [
      'Chave de Acesso', 'Arquivo XML', 'Tipo', 'Nº NF/CT-e',
      'Série', 'Data Emissão', 'CNPJ Emitente', 'Razão Social', 'Valor (R$)',
    ];
    this.addNavyRow(ws, headers, headers.length);

    ws.columns = [
      { width: 46 }, { width: 35 }, { width: 8 }, { width: 12 },
      { width: 8 }, { width: 22 }, { width: 18 }, { width: 35 }, { width: 14 },
    ];

    data.xmlsNotInSped.forEach((item, i) => {
      const row = ws.addRow([
        item.chave,
        item.filename,
        item.tipo,
        item.nNF ?? '',
        item.serie ?? '',
        this.formatDhEmi(item.dhEmi),
        item.cnpjEmit ?? '',
        item.xNomeEmit ?? '',
        item.vNF ?? '',
      ]);
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
      }
    });

    if (data.xmlsNotInSped.length === 0) {
      const row = ws.addRow(['Nenhuma divergência encontrada — todos os XMLs estão no SPED.']);
      row.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
    }
  }

  private buildSpedNotInXmlSheet(wb: ExcelJS.Workbook, data: ConfrontResultDto) {
    const ws = wb.addWorksheet('SPED sem XML');

    const headers = [
      'Chave de Acesso', 'Registro', 'Modelo', 'Série', 'Nº Doc',
      'Data Documento', 'Situação', 'Operação',
    ];
    this.addNavyRow(ws, headers, headers.length);

    ws.columns = [
      { width: 46 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 12 },
      { width: 14 }, { width: 10 }, { width: 10 },
    ];

    data.spedNotInXml.forEach((item, i) => {
      const row = ws.addRow([
        item.chave,
        item.registro,
        this.modeloLabel(item.codMod),
        item.ser ?? '',
        item.numDoc ?? '',
        this.formatDate(item.dtDoc),
        this.situacaoLabel(item.codSit),
        item.indOper === '0' ? 'Entrada' : 'Saída',
      ]);
      if (i % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
      }
      // Sinalizar cancelados/denegados
      if (['02', '03', '04', '07'].includes(item.codSit ?? '')) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      }
    });

    if (data.spedNotInXml.length === 0) {
      const row = ws.addRow(['Nenhuma divergência encontrada — todos os registros SPED têm XML.']);
      row.getCell(1).font = { italic: true, color: { argb: 'FF27AE60' } };
    }
  }

  private addNavyRow(ws: ExcelJS.Worksheet, values: (string | number)[], colSpan: number) {
    const row = ws.addRow(values);
    row.height = 22;
    for (let i = 1; i <= colSpan; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
      cell.alignment = { vertical: 'middle' };
    }
  }

  // ------------------------------------------------------------------
  // PDF
  // ------------------------------------------------------------------

  async generatePdf(data: ConfrontResultDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const navy = '#1e3a5f';
      const pageWidth = doc.page.width - 80;

      // Cabeçalho
      doc.rect(40, 40, pageWidth, 50).fill(navy);
      doc
        .fillColor('white')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('CONFRONTO SPED x XML — RELATÓRIO FISCAL', 50, 55);

      doc.fillColor('black').moveDown(3);

      // Info empresa
      doc.fontSize(10).font('Helvetica-Bold').text('DADOS DO CONTRIBUINTE', { underline: true });
      doc.font('Helvetica').moveDown(0.3);
      const info = [
        ['Empresa', data.spedInfo.nome],
        ['CNPJ', data.spedInfo.cnpj],
        ['UF', data.spedInfo.uf],
        ['Período', `${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`],
        ['Arquivo SPED', data.spedFilename],
        ['Data do confronto', new Date(data.createdAt).toLocaleString('pt-BR')],
      ];
      for (const [k, v] of info) {
        doc.font('Helvetica-Bold').text(`${k}: `, { continued: true });
        doc.font('Helvetica').text(String(v));
      }

      doc.moveDown();

      // Totais
      doc.fontSize(10).font('Helvetica-Bold').text('RESUMO DO CONFRONTO', { underline: true });
      doc.font('Helvetica').moveDown(0.3);
      const totais = [
        ['Total de entradas no SPED', data.totalSpedEntries],
        ['Total de XMLs enviados', data.totalXmls],
        ['Documentos conferidos (OK)', data.totalMatches],
        ['XMLs não escriturados no SPED', data.xmlsNotInSped.length],
        ['SPED sem XML correspondente', data.spedNotInXml.length],
      ];
      for (const [k, v] of totais) {
        const isDivergencia = String(k).includes('não') || String(k).includes('sem');
        doc.font('Helvetica-Bold').text(`${k}: `, { continued: true });
        doc
          .font('Helvetica')
          .fillColor(isDivergencia && Number(v) > 0 ? '#c0392b' : 'black')
          .text(String(v));
        doc.fillColor('black');
      }

      doc.moveDown();

      // Tabela XMLs não no SPED
      this.pdfSection(
        doc,
        `XMLs NÃO ESCRITURADOS NO SPED (${data.xmlsNotInSped.length})`,
        navy,
        data.xmlsNotInSped.length === 0
          ? [['Nenhuma divergência — todos os XMLs estão escriturados.']]
          : data.xmlsNotInSped.map((x) => [
              this.truncate(x.chave, 44),
              this.truncate(x.filename, 25),
              x.nNF ?? '',
              this.formatDhEmi(x.dhEmi),
              x.xNomeEmit ?? '',
            ]),
        data.xmlsNotInSped.length === 0
          ? ['Observação']
          : ['Chave', 'Arquivo', 'Nº NF', 'Emissão', 'Emitente'],
      );

      doc.moveDown();

      // Tabela SPED sem XML
      this.pdfSection(
        doc,
        `SPED SEM XML CORRESPONDENTE (${data.spedNotInXml.length})`,
        navy,
        data.spedNotInXml.length === 0
          ? [['Nenhuma divergência — todos os registros têm XML.']]
          : data.spedNotInXml.map((x) => [
              this.truncate(x.chave, 44),
              this.modeloLabel(x.codMod),
              x.numDoc ?? '',
              this.formatDate(x.dtDoc),
              this.situacaoLabel(x.codSit),
            ]),
        data.spedNotInXml.length === 0
          ? ['Observação']
          : ['Chave', 'Modelo', 'Nº Doc', 'Dt Doc', 'Situação'],
      );

      // Rodapé
      doc
        .moveDown(2)
        .fontSize(8)
        .fillColor('#888888')
        .text(
          `Gerado em ${new Date().toLocaleString('pt-BR')} pelo sistema AnaliseSped`,
          { align: 'center' },
        );

      doc.end();
    });
  }

  private pdfSection(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    doc: any,
    title: string,
    navy: string,
    rows: string[][],
    headers: string[],
  ) {
    doc.fontSize(10).font('Helvetica-Bold').fillColor(navy).text(title);
    doc.fillColor('black').font('Helvetica').fontSize(8).moveDown(0.3);

    const colWidths = headers.map(() => (doc.page.width - 80) / headers.length);

    // Header row
    let x = 40;
    const y = doc.y;
    doc.rect(40, y, doc.page.width - 80, 14).fill(navy);
    headers.forEach((h, i) => {
      doc
        .fillColor('white')
        .text(h, x + 2, y + 2, { width: colWidths[i], lineBreak: false });
      x += colWidths[i];
    });
    doc.fillColor('black').moveDown(0.1);

    // Data rows
    rows.slice(0, 100).forEach((row, ri) => {
      if (doc.y > doc.page.height - 100) doc.addPage();
      const rowY = doc.y;
      if (ri % 2 === 0) {
        doc.rect(40, rowY, doc.page.width - 80, 12).fill('#E8EFF8');
      }
      let rx = 40;
      row.forEach((cell, ci) => {
        doc
          .fillColor('black')
          .text(cell, rx + 2, rowY + 1, { width: colWidths[ci] - 4, lineBreak: false });
        rx += colWidths[ci];
      });
      doc.moveDown(0.6);
    });

    if (rows.length > 100) {
      doc.fontSize(8).fillColor('#888').text(`... e mais ${rows.length - 100} registros. Baixe o Excel para ver todos.`);
      doc.fillColor('black');
    }
  }

  // ------------------------------------------------------------------
  // E-mail
  // ------------------------------------------------------------------

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
    const pdfBuffer = await this.generatePdf(data);

    const periodo = `${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: `Confronto SPED x XML — ${data.spedInfo.nome} — ${periodo}`,
      html: this.buildEmailHtml(data, message),
      attachments: [
        {
          filename: `confronto_${data.spedInfo.cnpj}.xlsx`,
          content: excelBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        {
          filename: `confronto_${data.spedInfo.cnpj}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    this.logger.log(`E-mail enviado para ${to}`);
  }

  private buildEmailHtml(data: ConfrontResultDto, message?: string): string {
    const periodo = `${this.formatDate(data.spedInfo.dtIni)} a ${this.formatDate(data.spedInfo.dtFin)}`;
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #1e3a5f; padding: 20px; color: white;">
          <h2 style="margin:0">Confronto SPED x XML — Relatório Fiscal</h2>
        </div>
        <div style="padding: 20px; background: #f8f9fa;">
          ${message ? `<p style="border-left: 4px solid #1e3a5f; padding-left: 12px; color: #333;">${message}</p>` : ''}
          <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
            <tr><td style="font-weight:bold; padding: 4px 8px;">Empresa</td><td>${data.spedInfo.nome}</td></tr>
            <tr style="background:#eef;"><td style="font-weight:bold; padding: 4px 8px;">CNPJ</td><td>${data.spedInfo.cnpj}</td></tr>
            <tr><td style="font-weight:bold; padding: 4px 8px;">Período</td><td>${periodo}</td></tr>
            <tr style="background:#eef;"><td style="font-weight:bold; padding: 4px 8px;">Entradas SPED</td><td>${data.totalSpedEntries}</td></tr>
            <tr><td style="font-weight:bold; padding: 4px 8px;">XMLs enviados</td><td>${data.totalXmls}</td></tr>
            <tr style="background:#eef;"><td style="font-weight:bold; padding: 4px 8px;">Conferidos (OK)</td><td>${data.totalMatches}</td></tr>
            <tr style="${data.xmlsNotInSped.length > 0 ? 'background:#fde8e8;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">XMLs não no SPED</td><td><strong>${data.xmlsNotInSped.length}</strong></td></tr>
            <tr style="${data.spedNotInXml.length > 0 ? 'background:#fde8e8;' : ''}"><td style="font-weight:bold; padding: 4px 8px;">SPED sem XML</td><td><strong>${data.spedNotInXml.length}</strong></td></tr>
          </table>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">Relatório em anexo (Excel + PDF). Gerado em ${new Date().toLocaleString('pt-BR')} pelo sistema AnaliseSped.</p>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------

  private formatDate(dt?: string): string {
    if (!dt || dt.length < 8) return dt ?? '';
    // DDMMAAAA → DD/MM/AAAA
    return `${dt.slice(0, 2)}/${dt.slice(2, 4)}/${dt.slice(4, 8)}`;
  }

  private formatDhEmi(dh?: string): string {
    if (!dh) return '';
    // Pode vir como ISO 8601 ou DDMMAAAA
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

  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n) : s;
  }
}
