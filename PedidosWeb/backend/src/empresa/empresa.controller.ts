import { Controller, Get, UseGuards } from '@nestjs/common'
import { EmpresaService } from './empresa.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly svc: EmpresaService) {}

  @Get()
  obter() {
    return this.svc.obter()
  }
}
