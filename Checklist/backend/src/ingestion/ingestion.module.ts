import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { Lc214ChunkEntity } from '../entities/lc214-chunk.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Lc214ChunkEntity, NcmRowEntity, CclassTribRowEntity])],
  providers: [IngestionService],
  exports: [IngestionService],
})
export class IngestionModule {}
