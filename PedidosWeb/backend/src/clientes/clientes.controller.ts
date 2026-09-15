import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ClientesService } from './clientes.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

@UseGuards(JwtAuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly svc: ClientesService) {}

  @Get('padrao')
  padrao() {
    return this.svc.padrao()
  }

  @Get()
  buscar(@Query('q') q = '') {
    if (q.length < 2) return []
    return this.svc.buscar(q)
  }
}
