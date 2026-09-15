import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { FirebirdModule } from './firebird/firebird.module';
import { ClientesModule } from './clientes/clientes.module';
import { ProdutosModule } from './produtos/produtos.module';
import { CondicoesModule } from './condicoes-pagamento/condicoes.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { EmpresaModule } from './empresa/empresa.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 60 }],
    }),
    FirebirdModule,
    AuthModule,
    ClientesModule,
    ProdutosModule,
    CondicoesModule,
    PedidosModule,
    EmpresaModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
