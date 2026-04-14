import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfrontSession } from '../entities/confront-session.entity';
import { SpedService } from '../sped/sped.service';
import { XmlParserService } from '../xml-parser/xml-parser.service';
import { SpedEntry } from '../sped/sped.types';
import { XmlEntry } from '../xml-parser/xml-parser.types';
import {
  AuditItemDto,
  AuditReportDto,
  ConfrontResultDto,
  ConfrontSessionSummaryDto,
  DashboardDto,
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
    const {
      xmlsNotInSped, spedNotInXml, matchedWithValueDiff,
      totalVlSpedMatched, totalVlXmlMatched,
    } = this.compare(spedEntries, xmlEntries);

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
      spedEntries.length - spedNotInXml.length;

    // 6. Calcular dashboard (totais + CFOP)
    const dashboard = this.buildDashboard(spedEntries, xmlEntries, spedResult.cfopSummary);

    // 7. Relatório de auditoria
    const totalVlXmlNotInSped  = xmlsNotInSped.reduce((s, e) => s + (parseFloat(e.vNF ?? '0') || 0), 0);
    const totalVlSpedNotInXml  = spedNotInXml.reduce((s, e) => s + (e.vlDoc ?? 0), 0);

    const audit = this.buildAuditReport(
      spedEntries.length,
      xmlEntries.length,
      totalMatches,
      dashboard.totalVlSpedGeral,
      dashboard.totalVlXmlGeral,
      xmlsNotInSped.length,
      spedNotInXml.length,
      matchedWithValueDiff,
      totalVlSpedMatched,
      totalVlXmlMatched,
      totalVlXmlNotInSped,
      totalVlSpedNotInXml,
    );

    // 8. Persistir sessão
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
      dashboardJson: JSON.stringify(dashboard),
      auditJson: JSON.stringify(audit),
    });

    await this.sessionRepo.save(session);
    this.logger.log(`Sessão criada: ${session.id}`);

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlResult.errors, xmlsSemAutorizacao, filtroEmissao, dashboard, audit);
  }

  async getSession(id: string): Promise<ConfrontResultDto> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Sessão ${id} não encontrada`);

    const xmlsNotInSped: XmlItemDto[] = JSON.parse(session.xmlsNotInSpedJson ?? '[]');
    const spedNotInXml: SpedItemDto[] = JSON.parse(session.spedNotInXmlJson ?? '[]');
    const xmlsSemAutorizacao: XmlItemDto[] = JSON.parse(session.xmlsSemAutorizacaoJson ?? '[]');
    const xmlErrors: Array<{ filename: string; reason: string }> = JSON.parse(session.xmlErrorsJson ?? '[]');
    const dashboard: DashboardDto = JSON.parse(session.dashboardJson ?? 'null') ?? this.emptyDashboard();
    const audit: AuditReportDto = JSON.parse(session.auditJson ?? 'null') ?? this.emptyAudit();

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlErrors, xmlsSemAutorizacao, undefined, dashboard, audit);
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
  ): {
    xmlsNotInSped: XmlItemDto[];
    spedNotInXml: SpedItemDto[];
    matchedWithValueDiff: AuditItemDto[];
    totalVlSpedMatched: number;
    totalVlXmlMatched: number;
  } {
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
          vlDoc: sped.vlDoc,
        });
      }
    }

    // Pares encontrados nos dois lados: acumular totais e detectar divergência de valor
    const matchedWithValueDiff: AuditItemDto[] = [];
    let totalVlSpedMatched = 0;
    let totalVlXmlMatched  = 0;

    for (const [chave, sped] of spedChaves) {
      const xml = xmlChaves.get(chave);
      if (xml) {
        const vlSped = sped.vlDoc ?? 0;
        const vlXml  = parseFloat(xml.vNF ?? '0') || 0;
        totalVlSpedMatched += vlSped;
        totalVlXmlMatched  += vlXml;
        const diferenca = Math.abs(vlSped - vlXml);
        if (diferenca > 0.01) {
          matchedWithValueDiff.push({
            chave,
            registro:   sped.registro,
            numDoc:     sped.numDoc,
            dtDoc:      sped.dtDoc,
            indOper:    sped.indOper,
            nNF:        xml.nNF,
            dhEmi:      xml.dhEmi,
            cnpjEmit:   xml.cnpjEmit,
            xNomeEmit:  xml.xNomeEmit,
            vlSped,
            vlXml,
            diferenca,
          });
        }
      }
    }

    return { xmlsNotInSped, spedNotInXml, matchedWithValueDiff, totalVlSpedMatched, totalVlXmlMatched };
  }

  private buildDashboard(
    spedEntries: SpedEntry[],
    xmlEntries: XmlEntry[],
    cfopSummary: import('../sped/sped.types').SpedC190[],
  ): DashboardDto {
    const sumSped = (filter: (e: SpedEntry) => boolean) =>
      spedEntries.filter(filter).reduce((s, e) => s + (e.vlDoc ?? 0), 0);

    const sumXml = (filter: (e: XmlEntry) => boolean) =>
      xmlEntries.filter(filter).reduce((s, e) => s + (parseFloat(e.vNF ?? '0') || 0), 0);

    return {
      totalVlSpedGeral:    sumSped(() => true),
      totalVlSpedEntradas: sumSped((e) => e.indOper === '0'),
      totalVlSpedSaidas:   sumSped((e) => e.indOper === '1'),
      totalVlXmlGeral:     sumXml(() => true),
      totalVlXmlEntradas:  sumXml((e) => e.tpNF === '0'),
      totalVlXmlSaidas:    sumXml((e) => e.tpNF === '1'),
      cfopSummary: cfopSummary.map((c) => ({
        cfop: c.cfop,
        cstIcms: c.cstIcms,
        aliqIcms: c.aliqIcms,
        vlBcIcms: c.vlBcIcms,
        vlIcms: c.vlIcms,
        vlBcIcmsSt: c.vlBcIcmsSt,
        vlIcmsSt: c.vlIcmsSt,
        vlOpr: c.vlOpr,
      })),
    };
  }

  private buildAuditReport(
    totalSpedCount: number,
    totalXmlCount: number,
    matchedCount: number,
    totalSpedValue: number,
    totalXmlValue: number,
    xmlsNotInSpedCount: number,
    spedNotInXmlCount: number,
    matchedWithValueDiff: AuditItemDto[],
    totalVlSpedMatched: number,
    totalVlXmlMatched: number,
    totalVlXmlNotInSped: number,
    totalVlSpedNotInXml: number,
  ): AuditReportDto {
    const totalValueDiff = Math.abs(totalSpedValue - totalXmlValue);
    const verdictMessages: string[] = [];
    let verdict: 'ok' | 'atencao' | 'divergencia' = 'ok';

    if (spedNotInXmlCount > 0) {
      verdictMessages.push(
        `${spedNotInXmlCount} registro(s) escriturado(s) no SPED sem XML correspondente.`,
      );
      verdict = 'divergencia';
    }
    if (xmlsNotInSpedCount > 0) {
      verdictMessages.push(
        `${xmlsNotInSpedCount} XML(s) não escriturado(s) no SPED.`,
      );
      verdict = 'divergencia';
    }
    const brl = (v: number) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (totalValueDiff > 0.01) {
      const pct = totalSpedValue > 0
        ? ((totalValueDiff / totalSpedValue) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
      verdictMessages.push(
        `Diferença de valor total: R$ ${brl(totalValueDiff)} (${pct}%) — SPED R$ ${brl(totalSpedValue)} × XML R$ ${brl(totalXmlValue)}.`,
      );
      if (verdict !== 'divergencia') {
        verdict = totalValueDiff > 100 ||
          (totalSpedValue > 0 && totalValueDiff / totalSpedValue > 0.01)
          ? 'divergencia'
          : 'atencao';
      }
    }
    if (matchedWithValueDiff.length > 0) {
      const totalDivDoc = matchedWithValueDiff.reduce((s, r) => s + r.diferenca, 0);
      verdictMessages.push(
        `${matchedWithValueDiff.length} documento(s) conferidos com divergência de valor (soma: R$ ${brl(totalDivDoc)}).`,
      );
      if (verdict === 'ok') verdict = 'atencao';
    }

    if (verdictMessages.length === 0) {
      verdictMessages.push(
        `Conferência concluída: ${matchedCount} documento(s) com chave, quantidade e valores consistentes entre SPED e XML.`,
      );
    }

    return {
      totalSpedCount,
      totalXmlCount,
      matchedCount,
      totalSpedValue,
      totalXmlValue,
      totalValueDiff,
      totalVlSpedMatched,
      totalVlXmlMatched,
      totalVlXmlNotInSped,
      totalVlSpedNotInXml,
      matchedWithValueDiff,
      verdict,
      verdictMessages,
    };
  }

  private emptyAudit(): AuditReportDto {
    return {
      totalSpedCount: 0, totalXmlCount: 0, matchedCount: 0,
      totalSpedValue: 0, totalXmlValue: 0, totalValueDiff: 0,
      totalVlSpedMatched: 0, totalVlXmlMatched: 0,
      totalVlXmlNotInSped: 0, totalVlSpedNotInXml: 0,
      matchedWithValueDiff: [], verdict: 'ok', verdictMessages: [],
    };
  }

  private emptyDashboard(): DashboardDto {
    return {
      totalVlSpedGeral: 0, totalVlSpedEntradas: 0, totalVlSpedSaidas: 0,
      totalVlXmlGeral: 0,  totalVlXmlEntradas: 0,  totalVlXmlSaidas: 0,
      cfopSummary: [],
    };
  }

  private toDto(
    session: ConfrontSession,
    xmlsNotInSped: XmlItemDto[],
    spedNotInXml: SpedItemDto[],
    xmlErrors: Array<{ filename: string; reason: string }>,
    xmlsSemAutorizacao: XmlItemDto[] = [],
    filtroEmissao: 'todas' | 'proprias' | 'terceiros' = 'todas',
    dashboard: DashboardDto = this.emptyDashboard(),
    audit: AuditReportDto = this.emptyAudit(),
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
      dashboard,
      audit,
    };
  }
}
