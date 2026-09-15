import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, ParseIntPipe } from '@nestjs/common'
import { PedidosService } from './pedidos.service'
import { CriarPedidoDto } from './dto/criar-pedido.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

interface AuthRequest {
  user: { userId: string }
  ip?: string
}

@UseGuards(JwtAuthGuard)
@Controller('pedidos')
export class PedidosController {
  constructor(private readonly svc: PedidosService) {}

  @Get()
  listar(@Query('status') status?: string) {
    return this.svc.listar(status)
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.svc.obter(id)
  }

  @Post()
  criar(@Body() dto: CriarPedidoDto, @Request() req: AuthRequest) {
    return this.svc.criar(dto, req.user.userId)
  }

  @Post(':id/transmitir')
  transmitir(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.svc.transmitir(id, req.user.userId)
  }

  @Post(':id/finalizar')
  finalizar(@Param('id', ParseIntPipe) id: number, @Request() req: AuthRequest) {
    return this.svc.finalizar(id, req.user.userId)
  }

  @Post(':id/cancelar')
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() body: { motivo?: string }, @Request() req: AuthRequest) {
    return this.svc.cancelar(id, req.user.userId, body?.motivo)
  }
}
