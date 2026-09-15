import { Module } from '@nestjs/common'
import { EmpresaService } from './empresa.service'
import { EmpresaController } from './empresa.controller'
import { FirebirdModule } from '../firebird/firebird.module'

@Module({
  imports: [FirebirdModule],
  controllers: [EmpresaController],
  providers: [EmpresaService],
})
export class EmpresaModule {}
