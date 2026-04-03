import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BatchService } from './batch.service';

@Controller('batch')
@UseGuards(JwtAuthGuard)
export class BatchController {
  constructor(private readonly batch: BatchService) {}

  @Post('process')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async process(
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo .xlsx no campo "file".');
    }
    if (!file.originalname.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('Apenas arquivos .xlsx são aceitos.');
    }

    const resultBuffer = await this.batch.processFile(file.buffer);
    const outName = file.originalname.replace(/\.xlsx$/i, '_analisado.xlsx');

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(outName)}"`,
    });

    return new StreamableFile(resultBuffer);
  }

  @Post('process-xml')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async processXml(
    @UploadedFile() file: Express.Multer.File,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo .xml no campo "file".');
    }
    if (!file.originalname.toLowerCase().endsWith('.xml')) {
      throw new BadRequestException('Apenas arquivos .xml são aceitos.');
    }

    const resultBuffer = await this.batch.processXmlFile(file.buffer);
    const outName = file.originalname.replace(/\.xml$/i, '_analisado.xlsx');

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(outName)}"`,
    });

    return new StreamableFile(resultBuffer);
  }

  /** Processa múltiplos XMLs NF-e e retorna um único XLSX consolidado. */
  @Post('merge-xml')
  @UseInterceptors(FilesInterceptor('files', 50, { limits: { fileSize: 20 * 1024 * 1024 } }))
  async mergeXml(
    @UploadedFiles() files: Express.Multer.File[],
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Envie ao menos um arquivo .xml no campo "files".');
    }

    const xmlFiles = files.filter((f) => f.originalname.toLowerCase().endsWith('.xml'));
    if (xmlFiles.length === 0) {
      throw new BadRequestException('Apenas arquivos .xml são aceitos.');
    }

    const inputs = xmlFiles.map((f) => ({ buffer: f.buffer, name: f.originalname }));
    const resultBuffer = await this.batch.mergeXmlFiles(inputs);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent('nfe_consolidado.xlsx')}"`,
    });

    return new StreamableFile(resultBuffer);
  }
}
