import { Controller, Get, UseGuards } from '@nestjs/common'
import { CondicoesService } from './condicoes.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('condicoes-pagamento')
export class CondicoesController {
  constructor(private readonly svc: CondicoesService) {}

  @Get()
  listar() {
    return this.svc.listar()
  }
}
