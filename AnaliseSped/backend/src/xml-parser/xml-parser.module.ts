import { Module } from '@nestjs/common';
import { XmlParserService } from './xml-parser.service';

@Module({
  providers: [XmlParserService],
  exports: [XmlParserService],
})
export class XmlParserModule {}
