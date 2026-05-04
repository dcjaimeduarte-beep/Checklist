import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfrontService } from './confront.service';
import { ReportService } from '../report/report.service';
import { SendEmailDto } from './dto/send-email.dto';

@UseGuards(JwtAuthGuard)
@Controller('confront')
export class ConfrontController {
  constructor(
    private readonly confrontService: ConfrontService,
    private readonly reportService: ReportService,
  ) {}

  /** Executa confronto enviando SPED + XMLs em multipart */
  @Post('run')
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: memoryStorage(),
      limits: { fileSize: 300 * 1024 * 1024 },
    }),
  )
  async run(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('filtroEmissao') filtroEmissaoRaw?: string,
  ) {
    const allFiles = files ?? [];

    const spedFile = allFiles.find((f) => f.fieldname === 'sped');
    if (!spedFile) {
      throw new BadRequestException('Arquivo SPED não enviado (campo "sped")');
    }

    const xmlFiles = allFiles
      .filter((f) => f.fieldname === 'xmls')
      .map((f) => ({ buffer: f.buffer, originalname: f.originalname }));

    const filtroEmissao =
      filtroEmissaoRaw === 'proprias' || filtroEmissaoRaw === 'terceiros'
        ? filtroEmissaoRaw
        : 'todas';

    return this.confrontService.run(
      spedFile.buffer,
      spedFile.originalname,
      xmlFiles,
      filtroEmissao,
    );
  }

  /** Lista sessões de confronto (paginado) */
  @Get('sessions')
  async sessions(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.confrontService.listSessions(Number(page), Number(limit));
  }

  /** Resultado completo de uma sessão */
  @Get(':id')
  async getSession(@Param('id') id: string) {
    return this.confrontService.getSession(id);
  }

  /** Download relatório Excel */
  @Get(':id/excel')
  async downloadExcel(@Param('id') id: string, @Res() res: Response) {
    const session = await this.confrontService.getSession(id);
    const buffer = await this.reportService.generateExcel(session);

    const filename = `confronto_${session.spedInfo.cnpj}_${session.spedInfo.dtIni}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** Download relatório PDF */
  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const session = await this.confrontService.getSession(id);
    const buffer = await this.reportService.generatePdf(session);

    const filename = `confronto_${session.spedInfo.cnpj}_${session.spedInfo.dtIni}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** Download Excel somente com a listagem de todas as notas */
  @Get(':id/excel-notas')
  async downloadExcelNotas(@Param('id') id: string, @Res() res: Response) {
    const session = await this.confrontService.getSession(id);
    const buffer = await this.reportService.generateExcelNotas(session);
    const filename = `todas_notas_${session.spedInfo.cnpj}_${session.spedInfo.dtIni}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  /** Envia relatório por e-mail */
  @Post(':id/email')
  async sendEmail(@Param('id') id: string, @Body() dto: SendEmailDto) {
    const session = await this.confrontService.getSession(id);
    await this.reportService.sendEmail(session, dto.to, dto.message);
    return { ok: true, message: `Relatório enviado para ${dto.to}` };
  }
}
