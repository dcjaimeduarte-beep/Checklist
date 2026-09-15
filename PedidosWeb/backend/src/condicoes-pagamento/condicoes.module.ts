import { Module } from '@nestjs/common'
import { CondicoesService } from './condicoes.service'
import { CondicoesController } from './condicoes.controller'

@Module({
  controllers: [CondicoesController],
  providers: [CondicoesService],
})
export class CondicoesModule {}
