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
  CancelamentoItemDto,
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

    // 3. Separar eventos de cancelamento dos XMLs regulares
    const cancelEntries = xmlResult.entries.filter((e) => e.tipo === 'CancelNFe');
    const regularXmlAll = xmlResult.entries.filter((e) => e.tipo !== 'CancelNFe');

    // Aplicar filtro de emissão
    //    IND_EMIT: '0' = emissão própria, '1' = terceiros
    let spedEntries = spedResult.entries;
    let xmlEntries  = regularXmlAll;

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
    // Chaves com evento de cancelamento confirmado são excluídas da divergência SPED×XML
    const cancelChaves = new Set(cancelEntries.map((e) => e.chave));
    const {
      xmlsNotInSped, spedNotInXml, matchedWithValueDiff,
      totalVlSpedMatched, totalVlXmlMatched,
      cancelledMatchedChaves,
    } = this.compare(spedEntries, xmlEntries, cancelChaves);

    // Conjunto unificado de chaves "canceladas conhecidas" (evento XML + COD_SIT 02/03/04 no SPED)
    const allCancelledChaves = new Set([...cancelChaves, ...cancelledMatchedChaves]);

    // 5. XMLs sem autorização SEFAZ — excluir XMLs de notas canceladas confirmadas
    //    (o nfce.xml de uma nota cancelada não deve aparecer como "sem autorização")
    const xmlsSemAutorizacao: XmlItemDto[] = xmlEntries
      .filter((e) => !e.autorizada && !allCancelledChaves.has(e.chave))
      .map((e) => this.toXmlItemDto(e.chave, e));

    // totalMatches = SPED entries que têm XML correspondente e são notas regulares
    // (excluir: sem XML com cancelamento, e com XML mas COD_SIT cancelado/denegado)
    const spedEntryChaveSet = new Set(spedEntries.map((e) => e.chave));
    const cancelInSpedCount = [...cancelChaves].filter((ch) => spedEntryChaveSet.has(ch)).length;
    const totalMatches = spedEntries.length
      - spedNotInXml.length
      - cancelInSpedCount
      - cancelledMatchedChaves.size;

    // 6. Calcular dashboard (totais + CFOP)
    const dashboard = this.buildDashboard(spedEntries, xmlEntries, spedResult.cfopSummary);

    // 6b. Consolidar eventos de cancelamento com SPED (usa ALL entries sem filtro)
    const allSpedMap = new Map<string, SpedEntry>(
      spedResult.entries.map((e) => [e.chave, e]),
    );
    // Inclui também chaves COD_SIT=02/03/04 do SPED filtrado que matcharam XML
    // (têm nota física mas foram canceladas — sem necessidade de evento para identificar)
    const cancelamentos = this.buildCancelamentos(cancelEntries, allSpedMap, cancelledMatchedChaves);

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
      cancelamentosJson: JSON.stringify(cancelamentos),
      totalCancelamentos: cancelamentos.length,
    });

    await this.sessionRepo.save(session);
    this.logger.log(`Sessão criada: ${session.id}`);

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlResult.errors, xmlsSemAutorizacao, filtroEmissao, dashboard, audit, cancelamentos);
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
    const cancelamentos: CancelamentoItemDto[] = JSON.parse(session.cancelamentosJson ?? '[]');

    return this.toDto(session, xmlsNotInSped, spedNotInXml, xmlErrors, xmlsSemAutorizacao, undefined, dashboard, audit, cancelamentos);
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

  /**
   * COD_SIT no SPED onde VL_DOC é sempre zero por design.
   * Notas canceladas (02/03) e denegadas (04) nunca têm valor fiscal — comparar
   * VL_DOC=0 contra vNF do XML não é divergência, é comportamento esperado.
   */
  private static readonly CODSIT_SEM_VALOR = new Set(['02', '03', '04']);

  private compare(
    spedEntries: SpedEntry[],
    xmlEntries: XmlEntry[],
    /** Chaves com evento de cancelamento confirmado — excluídas da divergência SPED×XML */
    cancelChaves: Set<string> = new Set(),
  ): {
    xmlsNotInSped: XmlItemDto[];
    spedNotInXml: SpedItemDto[];
    matchedWithValueDiff: AuditItemDto[];
    totalVlSpedMatched: number;
    totalVlXmlMatched: number;
    /** Chaves presentes em ambos os lados mas com COD_SIT cancelado/denegado */
    cancelledMatchedChaves: Set<string>;
  } {
    const spedChaves = new Map<string, SpedEntry>(
      spedEntries.map((e) => [e.chave, e]),
    );
    const xmlChaves = new Map<string, XmlEntry>(
      xmlEntries.map((e) => [e.chave, e]),
    );

    // XMLs sem entrada no SPED (e sem evento de cancelamento)
    const xmlsNotInSped: XmlItemDto[] = [];
    for (const [chave, xml] of xmlChaves) {
      if (!spedChaves.has(chave)) {
        xmlsNotInSped.push(this.toXmlItemDto(chave, xml));
      }
    }

    // SPED sem XML — excluir chaves com evento de cancelamento
    const spedNotInXml: SpedItemDto[] = [];
    for (const [chave, sped] of spedChaves) {
      if (!xmlChaves.has(chave) && !cancelChaves.has(chave)) {
        spedNotInXml.push(this.toSpedItemDto(chave, sped));
      }
    }

    // Pares encontrados nos dois lados
    const matchedWithValueDiff: AuditItemDto[] = [];
    const cancelledMatchedChaves = new Set<string>();
    let totalVlSpedMatched = 0;
    let totalVlXmlMatched  = 0;

    for (const [chave, sped] of spedChaves) {
      const xml = xmlChaves.get(chave);
      if (!xml) continue;

      // Nota cancelada/denegada no SPED: VL_DOC=0 é design, não é divergência.
      // Registrar como "cancelamento identificado" e pular comparação de valor.
      if (ConfrontService.CODSIT_SEM_VALOR.has(sped.codSit)) {
        cancelledMatchedChaves.add(chave);
        continue;
      }

      const vlSped = sped.vlDoc ?? 0;
      const vlXml  = parseFloat(xml.vNF ?? '0') || 0;
      totalVlSpedMatched += vlSped;
      totalVlXmlMatched  += vlXml;
      const diferenca = Math.abs(vlSped - vlXml);
      if (diferenca > 0.01) {
        matchedWithValueDiff.push({
          chave,
          registro:  sped.registro,
          numDoc:    sped.numDoc,
          dtDoc:     sped.dtDoc,
          indOper:   sped.indOper,
          nNF:       xml.nNF,
          dhEmi:     xml.dhEmi,
          cnpjEmit:  xml.cnpjEmit,
          xNomeEmit: xml.xNomeEmit,
          vlSped,
          vlXml,
          diferenca,
        });
      }
    }

    return { xmlsNotInSped, spedNotInXml, matchedWithValueDiff, totalVlSpedMatched, totalVlXmlMatched, cancelledMatchedChaves };
  }

  /**
   * Consolida eventos de cancelamento (tpEvento=110111) com registros do SPED.
   * Também adiciona entradas para notas com COD_SIT=02/03/04 no SPED que matcharam
   * XML mas não têm evento separado — identificadas via cancelledMatchedChaves.
   *
   * Classificação da situação:
   * - 'ok'      → noSped && COD_SIT em 02/03/04 (cancelado corretamente no SPED)
   * - 'atencao' → noSped && COD_SIT regular (ativo no SPED, mas cancelado no XML!)
   * - 'info'    → !noSped (não escriturada — normal para cancelamentos)
   */
  private buildCancelamentos(
    cancelEntries: import('../xml-parser/xml-parser.types').XmlEntry[],
    allSpedMap: Map<string, SpedEntry>,
    cancelledMatchedChaves: Set<string> = new Set(),
  ): CancelamentoItemDto[] {
    const result: CancelamentoItemDto[] = [];
    const processedChaves = new Set<string>();

    // 1. Processar eventos de cancelamento XML (procEventoNFe)
    for (const evt of cancelEntries) {
      processedChaves.add(evt.chave);
      const nNF = evt.chave.substring(25, 34).replace(/^0+/, '') || evt.chave.substring(25, 34);
      const spedEntry = allSpedMap.get(evt.chave);
      const noSped = !!spedEntry;

      let situacao: 'ok' | 'atencao' | 'info';
      if (!noSped) {
        situacao = 'info';
      } else if (ConfrontService.CODSIT_SEM_VALOR.has(spedEntry.codSit)) {
        situacao = 'ok';
      } else {
        situacao = 'atencao';   // ativo no SPED mas evento de cancelamento existe!
      }

      result.push({
        chave: evt.chave,
        filename: evt.filename,
        nNF,
        dhCancelamento: evt.dhRecbto,
        cStatEvento: evt.cStat ?? '',
        xMotivoEvento: evt.xMotivo ?? '',
        xJust: evt.xJust,
        noSped,
        codSitSped: spedEntry?.codSit,
        vlDocSped: spedEntry?.vlDoc,
        registroSped: spedEntry?.registro,
        situacao,
      });
    }

    // 2. Adicionar notas canceladas/denegadas detectadas via COD_SIT no SPED
    //    (COD_SIT=02/03/04 + XML correspondente presente, sem evento separado)
    for (const chave of cancelledMatchedChaves) {
      if (processedChaves.has(chave)) continue; // já incluída pelo evento XML
      const spedEntry = allSpedMap.get(chave);
      if (!spedEntry) continue;

      const nNF = chave.substring(25, 34).replace(/^0+/, '') || chave.substring(25, 34);
      result.push({
        chave,
        filename: '(identificado pelo SPED)',
        nNF,
        dhCancelamento: undefined,
        cStatEvento: '101',  // Cancelado
        xMotivoEvento: `COD_SIT=${spedEntry.codSit} no SPED EFD`,
        xJust: undefined,
        noSped: true,
        codSitSped: spedEntry.codSit,
        vlDocSped: spedEntry.vlDoc,
        registroSped: spedEntry.registro,
        situacao: 'ok',   // SPED já reflete o cancelamento corretamente
      });
    }

    return result;
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

    // VL_OPR do C190 = total operacional fiscal (exclui frete/seguro/acessórias)
    // CFOPs 1xxx/2xxx = entradas, 5xxx/6xxx = saídas
    const totalVlOprC190         = cfopSummary.reduce((s, c) => s + c.vlOpr, 0);
    const totalVlOprC190Entradas = cfopSummary.filter(c => ['1', '2'].includes(c.cfop[0])).reduce((s, c) => s + c.vlOpr, 0);
    const totalVlOprC190Saidas   = cfopSummary.filter(c => ['5', '6'].includes(c.cfop[0])).reduce((s, c) => s + c.vlOpr, 0);

    // Resumo XML por CFOP — usa vProd por item (cfopVprod) para alocação precisa.
    // Documentos com múltiplos CFOPs têm o valor dividido corretamente por item,
    // evitando dupla contagem quando o filtro inclui mais de um CFOP do mesmo documento.
    // vlBC, vlICMS, vlST continuam sendo totais do documento (sem detalhe por CFOP no XML).
    type XmlCfopAgg = { vlNF: number; vlBC: number; vlICMS: number; vlST: number; count: number; vlNFEntradas: number; vlNFSaidas: number };
    const xmlCfopAgg = new Map<string, XmlCfopAgg>();
    for (const xml of xmlEntries) {
      if (!xml.cfops) continue;
      const cfops  = xml.cfops.split(/[\s,]+/).map(c => c.trim()).filter(Boolean);
      const vlBC   = parseFloat(xml.vBC   ?? '0') || 0;
      const vlICMS = parseFloat(xml.vICMS ?? '0') || 0;
      const vlST   = parseFloat(xml.vST   ?? '0') || 0;
      for (const cfop of cfops) {
        // Usa vProd por CFOP se disponível; caso contrário distribui vNF igualmente entre CFOPs
        const vlNF = xml.cfopVprod?.[cfop]
          ?? (parseFloat(xml.vNF ?? '0') || 0) / cfops.length;
        const agg = xmlCfopAgg.get(cfop) ?? { vlNF: 0, vlBC: 0, vlICMS: 0, vlST: 0, count: 0, vlNFEntradas: 0, vlNFSaidas: 0 };
        agg.vlNF   += vlNF;
        agg.vlBC   += vlBC / cfops.length;
        agg.vlICMS += vlICMS / cfops.length;
        agg.vlST   += vlST / cfops.length;
        agg.count  += 1;
        if (xml.tpNF === '0') agg.vlNFEntradas += vlNF;
        if (xml.tpNF === '1') agg.vlNFSaidas   += vlNF;
        xmlCfopAgg.set(cfop, agg);
      }
    }
    const xmlCfopSummary = [...xmlCfopAgg.entries()]
      .map(([cfop, agg]) => ({ cfop, ...agg }))
      .sort((a, b) => a.cfop.localeCompare(b.cfop));

    return {
      totalVlSpedGeral:    sumSped(() => true),
      totalVlSpedEntradas: sumSped((e) => e.indOper === '0'),
      totalVlSpedSaidas:   sumSped((e) => e.indOper === '1'),
      totalVlOprC190,
      totalVlOprC190Entradas,
      totalVlOprC190Saidas,
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
      xmlCfopSummary,
    };
  }

  private toXmlItemDto(chave: string, xml: XmlEntry): XmlItemDto {
    return {
      chave, filename: xml.filename, tipo: xml.tipo,
      nNF: xml.nNF, serie: xml.serie, dhEmi: xml.dhEmi,
      cnpjEmit: xml.cnpjEmit, xNomeEmit: xml.xNomeEmit,
      vNF: xml.vNF, cfops: xml.cfops,
      vBC: xml.vBC, vICMS: xml.vICMS,
      vBCST: xml.vBCST, vST: xml.vST,
      vIPI: xml.vIPI, vPIS: xml.vPIS, vCOFINS: xml.vCOFINS,
      vDesc: xml.vDesc, vFrete: xml.vFrete,
      tpNF: xml.tpNF, cStat: xml.cStat, xMotivo: xml.xMotivo,
      dhRecbto: xml.dhRecbto, autorizada: xml.autorizada,
    };
  }

  private toSpedItemDto(chave: string, sped: SpedEntry): SpedItemDto {
    return {
      chave, registro: sped.registro, codMod: sped.codMod,
      ser: sped.ser, numDoc: sped.numDoc, dtDoc: sped.dtDoc,
      codSit: sped.codSit, indOper: sped.indOper, indEmit: sped.indEmit,
      vlDoc: sped.vlDoc, vlBcIcms: sped.vlBcIcms, vlIcms: sped.vlIcms,
      vlBcIcmsSt: sped.vlBcIcmsSt, vlIcmsSt: sped.vlIcmsSt,
      vlIpi: sped.vlIpi, vlPis: sped.vlPis, vlCofins: sped.vlCofins,
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
      totalVlOprC190: 0, totalVlOprC190Entradas: 0, totalVlOprC190Saidas: 0,
      totalVlXmlGeral: 0,  totalVlXmlEntradas: 0,  totalVlXmlSaidas: 0,
      cfopSummary: [], xmlCfopSummary: [],
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
    cancelamentos: CancelamentoItemDto[] = [],
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
      cancelamentos,
      totalCancelamentos: session.totalCancelamentos ?? cancelamentos.length,
    };
  }
}
