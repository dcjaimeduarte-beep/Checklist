import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfrontSession } from '../entities/confront-session.entity';
import { SpedModule } from '../sped/sped.module';
import { XmlParserModule } from '../xml-parser/xml-parser.module';
import { ReportModule } from '../report/report.module';
import { ConfrontController } from './confront.controller';
import { ConfrontService } from './confront.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ConfrontSession]),
    SpedModule,
    XmlParserModule,
    ReportModule,
  ],
  controllers: [ConfrontController],
  providers: [ConfrontService],
  exports: [ConfrontService],
})
export class ConfrontModule {}
