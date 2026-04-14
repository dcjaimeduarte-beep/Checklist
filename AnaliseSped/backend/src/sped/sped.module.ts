import { Module } from '@nestjs/common';
import { SpedService } from './sped.service';

@Module({
  providers: [SpedService],
  exports: [SpedService],
})
export class SpedModule {}
