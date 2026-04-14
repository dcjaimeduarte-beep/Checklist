import { Test, TestingModule } from '@nestjs/testing';
import { XmlParserService } from './xml-parser.service';

const NFE_XML = (chave: string) => `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${chave}" versao="4.00">
      <ide>
        <nNF>1</nNF>
        <serie>001</serie>
        <dhEmi>2025-04-01T10:00:00-03:00</dhEmi>
        <mod>55</mod>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>EMPRESA TESTE LTDA</xNome>
      </emit>
      <total>
        <ICMSTot>
          <vNF>1500.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <chNFe>${chave}</chNFe>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>`;

const CTE_XML = (chave: string) => `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="3.00">
  <CTe>
    <infCte Id="CTe${chave}" versao="3.00">
      <ide>
        <nCT>1</nCT>
        <serie>001</serie>
        <dhEmi>2025-04-01T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>TRANSPORTADORA LTDA</xNome>
      </emit>
      <vPrest>
        <vTPrest>500.00</vTPrest>
      </vPrest>
    </infCte>
  </CTe>
  <protCTe>
    <infProt>
      <chCTe>${chave}</chCTe>
    </infProt>
  </protCTe>
</cteProc>`;

describe('XmlParserService', () => {
  let service: XmlParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XmlParserService],
    }).compile();
    service = module.get<XmlParserService>(XmlParserService);
  });

  const chaveNFe = '35250512345678000195550010000000011000000019';
  const chaveCTe = '35250512345678000195570010000000011000000015';

  it('deve extrair chave de NF-e com protocolo', () => {
    const buf = Buffer.from(NFE_XML(chaveNFe), 'utf8');
    const entry = service.parseSingle(buf, 'nota1.xml');
    expect(entry).not.toBeNull();
    expect(entry!.chave).toBe(chaveNFe);
    expect(entry!.tipo).toBe('NFe');
    expect(entry!.cnpjEmit).toBe('12345678000195');
  });

  it('deve extrair chave de CT-e com protocolo', () => {
    const buf = Buffer.from(CTE_XML(chaveCTe), 'utf8');
    const entry = service.parseSingle(buf, 'cte1.xml');
    expect(entry).not.toBeNull();
    expect(entry!.chave).toBe(chaveCTe);
    expect(entry!.tipo).toBe('CTe');
  });

  it('deve retornar null para XML sem estrutura reconhecida', () => {
    const buf = Buffer.from('<root><foo>bar</foo></root>', 'utf8');
    const entry = service.parseSingle(buf, 'invalido.xml');
    expect(entry).toBeNull();
  });

  it('parseMany deve processar múltiplos XMLs e separar erros', () => {
    const files = [
      { buffer: Buffer.from(NFE_XML(chaveNFe), 'utf8'), originalname: 'nfe1.xml' },
      { buffer: Buffer.from('<invalido/>', 'utf8'), originalname: 'erro.xml' },
      { buffer: Buffer.from(CTE_XML(chaveCTe), 'utf8'), originalname: 'cte1.xml' },
    ];
    const result = service.parseMany(files);
    expect(result.entries).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].filename).toBe('erro.xml');
  });
});
