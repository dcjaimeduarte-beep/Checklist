import { Test, TestingModule } from '@nestjs/testing';
import { SpedService } from './sped.service';

describe('SpedService', () => {
  let service: SpedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpedService],
    }).compile();
    service = module.get<SpedService>(SpedService);
  });

  const buildSpedBuffer = (lines: string[]) =>
    Buffer.from(lines.join('\n'), 'utf8');

  it('deve extrair info do registro 0000', () => {
    const buf = buildSpedBuffer([
      '|0000|012|0|01012025|31012025|EMPRESA TESTE LTDA|12345678000195||SP|123456789||SUFRAMA|A|1|',
      '|9999|1|',
    ]);
    const result = service.parse(buf);
    expect(result.info.cnpj).toBe('12345678000195');
    expect(result.info.nome).toBe('EMPRESA TESTE LTDA');
    expect(result.info.dtIni).toBe('01012025');
    expect(result.info.dtFin).toBe('31012025');
    expect(result.info.uf).toBe('SP');
  });

  it('deve extrair chave do registro C100', () => {
    const chave = '35250512345678000195550010000000011000000019';
    const buf = buildSpedBuffer([
      `|C100|1|1|001|55|00|001|000000001|${chave}|01012025|01012025|1500,00|0|||1500,00|0||||1500,00|270,00|||||||`,
    ]);
    const result = service.parse(buf);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].chave).toBe(chave);
    expect(result.entries[0].registro).toBe('C100');
    expect(result.entries[0].codSit).toBe('00');
  });

  it('deve extrair chave do registro D100', () => {
    const chave = '35250512345678000195570010000000011000000015';
    const buf = buildSpedBuffer([
      `|D100|1|1|001|57|00|001|0|000000001|${chave}|01012025|01012025|0|||500,00||||||||`,
    ]);
    const result = service.parse(buf);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].chave).toBe(chave);
    expect(result.entries[0].registro).toBe('D100');
  });

  it('deve ignorar C100 com chave inválida (vazia)', () => {
    const buf = buildSpedBuffer([
      '|C100|1|1|001|55|00|001|000000001||01012025|01012025|1500,00|0|||1500,00|0||||1500,00|270,00|||||||',
    ]);
    const result = service.parse(buf);
    expect(result.entries).toHaveLength(0);
    expect(result.invalidLines).toBe(1);
  });

  it('deve ignorar C100 com COD_SIT=05 (numeração inutilizada)', () => {
    const chave = '35250512345678000195550010000000011000000019';
    const buf = buildSpedBuffer([
      `|C100|1|1|001|55|05|001|000000001|${chave}|01012025|01012025|1500,00|0|||1500,00|0||||1500,00|270,00|||||||`,
    ]);
    const result = service.parse(buf);
    expect(result.entries).toHaveLength(0);
  });

  it('deve incluir C100 cancelado (COD_SIT=02)', () => {
    const chave = '35250512345678000195550010000000011000000019';
    const buf = buildSpedBuffer([
      `|C100|1|1|001|55|02|001|000000001|${chave}|01012025|01012025|1500,00|0|||1500,00|0||||1500,00|270,00|||||||`,
    ]);
    const result = service.parse(buf);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].codSit).toBe('02');
  });

  it('deve detectar BOM UTF-8 e parsear corretamente', () => {
    const content = '|0000|012|0|01012025|31012025|EMPRESA BOM|12345678000195||SP|123456789||\n';
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const buf = Buffer.concat([bom, Buffer.from(content, 'utf8')]);
    const result = service.parse(buf);
    expect(result.info.cnpj).toBe('12345678000195');
  });
});
