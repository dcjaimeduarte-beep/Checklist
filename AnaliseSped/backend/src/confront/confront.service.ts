import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfrontSession } from '../entities/confront-session.entity';
import { SpedService } from '../sped/sped.service';
import { XmlParserService } from '../xml-parser/xml-parser.service';
import { SpedEntry } from '../sped/sped.types';
import { XmlEntry } from '../xml-parser/xml-parser.types';
import {
  ConfrontResultDto,
  ConfrontSessionSummaryDto,
  SpedItemDto,
  XmlItemDto,
} from './dto/confront-result.dto';

@Injectable()
export class ConfrontService {
  private readonly logger = new Logger(ConfrontService.name);

  constructor(
    @InjectRepository(ConfrontSession)
    private readonly sessionRepo: Repository<ConfrontSession>,
    private readonly spedService: SpedService,
    private readonly xmlParserService: XmlParserService,
  ) {}

  /**
   * Executa o confronto SPED x XMLs e persiste o resultado.
   */
  async run(
    spedBuffer: Buffer,
    spedFilename: string,
    xmlFiles: Array<{ buffer: Buffer; originalname: string }>,
    filtroEmissao: 'todas' | 'proprias' | 'terceiros' = 'todas',
  ): Promise<ConfrontResultDto> {
    // 1. Parsear SPED
    const spedResult = this.spedService.parse(spedBuffer);

    // 2. Parsear XMLs
    const xmlResult = this.xmlParserService.parseMany(xmlFiles);

    // 3. Aplicar filtro de emissão
    //    IND_EMIT: '0' = emissão própria, '1' = terceiros
    let spedEntries = spedResult.entries;
    let xmlEntries  = xmlResult.entries;

    if (filtroEmissao === 'proprias') {
      spedEntries = spedEntries.filter((e) => e.indEmit === '0');
      // XML própria: CNPJ emitente = CNPJ do SPED (emissão própria)
      //              OU tpNF = '1' (saída — nota emitida pela empresa)
      xmlEntries  = xmlEntries.filter((e) =>
        (e.cnpjEmit && e.cnpjEmit === spedResult.info.cnpj) ||
        e.tpNF === '1',
      );
    } else if (filtroEmissao === 'terceiros') {
      spedEntries = spedEntries.filter((e) => e.indEmit === '1');
      // XML de terceiro: CNPJ emitente ≠ CNPJ do SPED
      //                  OU tpNF = '0' (entrada — nota recebida de terceiro)
      xmlEntries  = xmlEntries.filter((e) =>
        (e.cnpjEmit && e.cnpjEmit !== spedResult.info.cnpj) ||
        e.tpNF === '0',
      );
    }

    // 4. Confrontar
    const { xmlsNotInSped, spedNotInXml } = this.compare(
      spedEntries,
      xmlEntries,
    );

    // 5. XMLs sem autorização SEFAZ (do conjunto filtrado)
    const xmlsSemAutorizacao: XmlItemDto[] = xmlEntries
      .filter((e) => !e.autorizada)
      .map((e) => ({
        chave: e.chave,
        filename: e.filename,
        tipo: e.tipo,
        nNF: e.nNF,
        serie: e.serie,
        dhEmi: e.dhEmi,
        cnpjEmit: e.cnpjEmit,
        xNomeEmit: e.xNomeEmit,
        vNF: e.vNF,
        tpNF: e.tpNF,
        cStat: e.cStat,
        xMotivo: e.xMotivo,
        dhRecbto: e.dhRecbto,
        autorizada: e.autorizada,
      }));

    const totalMatches =
      spedResult.entries.length - spedNotInXml.length;

    // 6. Persistir sessão
    const session = this.sessionRepo.create({
      spedFilename,
      spedCnpj: spedResult.info.cnpj,
      spedNome: spedResult.info.nome,
      spedDtIni: spedResult.info.dtIni,
      spedDtFin: spedResult.info.dtFin,
      spedUf: spedResult.info.uf,
      totalSpedEntries: spedEntries.length,
      totalXmls: xmlEntries.length,
      totalMatches,
      filtroEmissao,
      xmlsNotInSpedJson: JSON.stringify(xmlsNotInSped),
      spedNotInXmlJson: JSON.stringify(spedNotInXml),
      xmlsSemAutorizacaoJson: JSON.stringify(xmlsSemAutorizacao),
      totalSemAutorizacao: xmlsSemAutorizacao.length,
      xmlErrorsJson: JSON.stringify(xmlResult.errors),
    });

    await this.sessionRepo.save(session);
    this.logger.log(`Sessão criada: ${session.id}`);

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlResult.errors, xmlsSemAutorizacao, filtroEmissao);
  }

  async getSession(id: string): Promise<ConfrontResultDto> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Sessão ${id} não encontrada`);

    const xmlsNotInSped: XmlItemDto[] = JSON.parse(session.xmlsNotInSpedJson ?? '[]');
    const spedNotInXml: SpedItemDto[] = JSON.parse(session.spedNotInXmlJson ?? '[]');
    const xmlsSemAutorizacao: XmlItemDto[] = JSON.parse(session.xmlsSemAutorizacaoJson ?? '[]');
    const xmlErrors: Array<{ filename: string; reason: string }> = JSON.parse(session.xmlErrorsJson ?? '[]');

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlErrors, xmlsSemAutorizacao);
  }

  async listSessions(page = 1, limit = 20): Promise<ConfrontSessionSummaryDto[]> {
    const sessions = await this.sessionRepo.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return sessions.map((s) => ({
      sessionId: s.id,
      createdAt: s.createdAt.toISOString(),
      spedFilename: s.spedFilename,
      spedCnpj: s.spedCnpj,
      spedNome: s.spedNome,
      spedDtIni: s.spedDtIni,
      spedDtFin: s.spedDtFin,
      totalSpedEntries: s.totalSpedEntries,
      totalXmls: s.totalXmls,
      totalMatches: s.totalMatches,
      divergencias:
        (s.totalSpedEntries - s.totalMatches) +
        (s.totalXmls - s.totalMatches),
    }));
  }

  // -------------------------------------------------------------------

  private compare(
    spedEntries: SpedEntry[],
    xmlEntries: XmlEntry[],
  ): { xmlsNotInSped: XmlItemDto[]; spedNotInXml: SpedItemDto[] } {
    const spedChaves = new Map<string, SpedEntry>(
      spedEntries.map((e) => [e.chave, e]),
    );
    const xmlChaves = new Map<string, XmlEntry>(
      xmlEntries.map((e) => [e.chave, e]),
    );

    const xmlsNotInSped: XmlItemDto[] = [];
    for (const [chave, xml] of xmlChaves) {
      if (!spedChaves.has(chave)) {
        xmlsNotInSped.push({
          chave,
          filename: xml.filename,
          tipo: xml.tipo,
          nNF: xml.nNF,
          serie: xml.serie,
          dhEmi: xml.dhEmi,
          cnpjEmit: xml.cnpjEmit,
          xNomeEmit: xml.xNomeEmit,
          vNF: xml.vNF,
          tpNF: xml.tpNF,
          cStat: xml.cStat,
          xMotivo: xml.xMotivo,
          dhRecbto: xml.dhRecbto,
          autorizada: xml.autorizada,
        });
      }
    }

    const spedNotInXml: SpedItemDto[] = [];
    for (const [chave, sped] of spedChaves) {
      if (!xmlChaves.has(chave)) {
        spedNotInXml.push({
          chave,
          registro: sped.registro,
          codMod: sped.codMod,
          ser: sped.ser,
          numDoc: sped.numDoc,
          dtDoc: sped.dtDoc,
          codSit: sped.codSit,
          indOper: sped.indOper,
          indEmit: sped.indEmit,
        });
      }
    }

    return { xmlsNotInSped, spedNotInXml };
  }

  private toDto(
    session: ConfrontSession,
    xmlsNotInSped: XmlItemDto[],
    spedNotInXml: SpedItemDto[],
    xmlErrors: Array<{ filename: string; reason: string }>,
    xmlsSemAutorizacao: XmlItemDto[] = [],
    filtroEmissao: 'todas' | 'proprias' | 'terceiros' = 'todas',
  ): ConfrontResultDto {
    return {
      sessionId: session.id,
      createdAt: session.createdAt.toISOString(),
      spedFilename: session.spedFilename,
      spedInfo: {
        cnpj: session.spedCnpj,
        nome: session.spedNome,
        dtIni: session.spedDtIni,
        dtFin: session.spedDtFin,
        uf: session.spedUf,
      },
      totalSpedEntries: session.totalSpedEntries,
      totalXmls: session.totalXmls,
      totalMatches: session.totalMatches,
      xmlsNotInSped,
      spedNotInXml,
      xmlErrors,
      xmlsSemAutorizacao,
      totalSemAutorizacao: session.totalSemAutorizacao ?? xmlsSemAutorizacao.length,
      apenasProprías: (session.filtroEmissao ?? filtroEmissao) === 'proprias',
      filtroEmissao: (session.filtroEmissao ?? filtroEmissao) as 'todas' | 'proprias' | 'terceiros',
    };
  }
}
