import { Controller, Get, Param, Query, Res, NotFoundException, UseGuards, ParseIntPipe } from '@nestjs/common'
import { SkipThrottle } from '@nestjs/throttler'
import type { Response } from 'express'
import * as path from 'path'
import * as fs from 'fs'
import { ProdutosService } from './produtos.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Public } from '../auth/public.decorator'

@UseGuards(JwtAuthGuard)
@Controller('produtos')
export class ProdutosController {
  constructor(private readonly svc: ProdutosService) {}

  @Get()
  buscar(@Query('q') q = '') {
    if (q.length < 1) return []
    return this.svc.buscar(q)
  }

@Public()
  @SkipThrottle()
  @Get(':id/imagem')
  imagem(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const filePath = this.svc.imagemPath(id)
    if (!filePath) throw new NotFoundException('Imagem não encontrada')

    const absPath = path.resolve(filePath)
    const ext = absPath.split('.').pop()?.toLowerCase() ?? 'jpg'
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg',
      png: 'image/png', webp: 'image/webp',
    }
    const buf = fs.readFileSync(absPath)
    res.setHeader('Content-Type', mimeMap[ext] ?? 'image/jpeg')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buf)
  }
}
