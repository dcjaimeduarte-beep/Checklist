import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConsultationService } from './consultation.service';
import { AnalyzeDto } from './dto/analyze.dto';

@Controller('consultation')
export class ConsultationController {
  constructor(private readonly consultation: ConsultationService) {}

  /**
   * Análise tributária: consulta, agregação e montagem da vista no servidor.
   * O cliente apenas renderiza o campo `view`.
   */
  @Post('analyze')
  @UseGuards(JwtAuthGuard)
  analyze(@Body() dto: AnalyzeDto) {
    return this.consultation.analyze(dto);
  }
}
