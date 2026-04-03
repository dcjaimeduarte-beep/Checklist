import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { Lc214ChunkEntity } from '../entities/lc214-chunk.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';
import { SearchResultCacheEntity } from '../entities/search-result-cache.entity';
import { WebFetchCacheEntity } from '../entities/web-fetch-cache.entity';
import { SiscomexService } from '../siscomex/siscomex.service';
import { ConsultationController } from './consultation.controller';
import { ConsultationService } from './consultation.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Lc214ChunkEntity,
      NcmRowEntity,
      CclassTribRowEntity,
      SearchResultCacheEntity,
      WebFetchCacheEntity,
    ]),
  ],
  controllers: [ConsultationController],
  providers: [ConsultationService, SiscomexService],
  exports: [ConsultationService],
})
export class ConsultationModule {}
