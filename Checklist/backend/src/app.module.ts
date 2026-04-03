import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { BatchModule } from './batch/batch.module';
import { ConsultationModule } from './consultation/consultation.module';
import { typeOrmSqliteConfig } from './config/database.config';
import { IngestionModule } from './ingestion/ingestion.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeOrmSqliteConfig()),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60_000,
          limit: 30,
        },
      ],
    }),
    AuthModule,
    IngestionModule,
    ConsultationModule,
    BatchModule,
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
