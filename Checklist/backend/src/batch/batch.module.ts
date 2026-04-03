import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([NcmRowEntity, CclassTribRowEntity]),
  ],
  controllers: [BatchController],
  providers: [BatchService],
})
export class BatchModule {}
