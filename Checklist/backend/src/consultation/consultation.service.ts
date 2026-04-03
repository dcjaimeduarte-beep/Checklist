import { createHash } from 'node:crypto';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import { Lc214ChunkEntity } from '../entities/lc214-chunk.entity';
import { NcmRowEntity } from '../entities/ncm-row.entity';
import { SearchResultCacheEntity } from '../entities/search-result-cache.entity';
import { SiscomexService } from '../siscomex/siscomex.service';
import { NCM_CHAPTER_SEARCH_TERMS, extractKeywords as extractKeywordsUtil } from './tax-analysis.utils';
import type { AnalyzeDto } from './dto/analyze.dto';
import type { AnalyzeResponseDto } from './dto/analyze-response.dto';
import type {
  CclassPanelDto,
  EffectiveRatesPanelDto,
  FiscalDocumentsDto,
  GroupIndicatorsDto,
  PossibleClassificationDto,
  ProductPanelDto,
  RegimeCreditsTransitionDto,
  StrategicAnalysisDto,
  TaxAnalysisViewDto,
  TaxSimulationDto,
} from './dto/tax-analysis-view.dto';

const EMPTY = '—';

/* ─── Alíquotas-referência 2026 (fase de teste) ─── */
const REF_IBS_RATE = 0.001; // 0.1%
const REF_CBS_RATE = 0.009; // 0.9%

/* ─── Simulação padrão ─── */
const SIM_PURCHASE = 1000;
const SIM_SALE = 1500;

/* ─── Seções NCM (capítulos → seção) ─── */
const NCM_SECTIONS: Record<string, string> = {
  '01': 'I', '02': 'I', '03': 'I', '04': 'I', '05': 'I',
  '06': 'II', '07': 'II', '08': 'II', '09': 'II', '10': 'II', '11': 'II', '12': 'II', '13': 'II', '14': 'II',
  '15': 'III',
  '16': 'IV', '17': 'IV', '18': 'IV', '19': 'IV', '20': 'IV', '21': 'IV', '22': 'IV', '23': 'IV', '24': 'IV',
  '25': 'V', '26': 'V', '27': 'V',
  '28': 'VI', '29': 'VI', '30': 'VI', '31': 'VI', '32': 'VI', '33': 'VI', '34': 'VI', '35': 'VI', '36': 'VI', '37': 'VI', '38': 'VI',
  '39': 'VII', '40': 'VII',
  '41': 'VIII', '42': 'VIII', '43': 'VIII',
  '44': 'IX', '45': 'IX', '46': 'IX',
  '47': 'X', '48': 'X', '49': 'X',
  '50': 'XI', '51': 'XI', '52': 'XI', '53': 'XI', '54': 'XI', '55': 'XI', '56': 'XI', '57': 'XI', '58': 'XI', '59': 'XI', '60': 'XI', '61': 'XI', '62': 'XI', '63': 'XI',
  '64': 'XII', '65': 'XII', '66': 'XII', '67': 'XII',
  '68': 'XIII', '69': 'XIII', '70': 'XIII',
  '71': 'XIV',
  '72': 'XV', '73': 'XV', '74': 'XV', '75': 'XV', '76': 'XV', '78': 'XV', '79': 'XV', '80': 'XV', '81': 'XV', '82': 'XV', '83': 'XV',
  '84': 'XVI', '85': 'XVI',
  '86': 'XVII', '87': 'XVII', '88': 'XVII', '89': 'XVII',
  '90': 'XVIII', '91': 'XVIII', '92': 'XVIII',
  '93': 'XIX',
  '94': 'XX', '95': 'XX', '96': 'XX',
  '97': 'XXI',
};

const SECTION_NAMES: Record<string, string> = {
  I: 'Animais Vivos e Produtos do Reino Animal',
  II: 'Produtos do Reino Vegetal',
  III: 'Gorduras e Óleos Animais ou Vegetais',
  IV: 'Produtos das Indústrias Alimentares; Bebidas, Líquidos Alcoólicos e Vinagres; Fumo',
  V: 'Produtos Minerais',
  VI: 'Produtos das Indústrias Químicas ou das Indústrias Conexas',
  VII: 'Plásticos e suas Obras; Borracha e suas Obras',
  VIII: 'Peles, Couros, Peleteria e suas Obras',
  IX: 'Madeira, Carvão Vegetal, Cortiça e suas Obras',
  X: 'Pastas de Madeira ou de Outras Matérias Fibrosas Celulósicas; Papel ou Cartão',
  XI: 'Matérias Têxteis e suas Obras',
  XII: 'Calçados, Chapéus e Artigos de Uso Semelhante',
  XIII: 'Obras de Pedra, Gesso, Cimento, Amianto, Mica ou de Matérias Semelhantes; Produtos Cerâmicos; Vidro e suas Obras',
  XIV: 'Pérolas Naturais ou Cultivadas, Pedras Preciosas, Metais Preciosos e suas Obras; Bijuteria; Moedas',
  XV: 'Metais Comuns e suas Obras',
  XVI: 'Máquinas e Aparelhos, Material Elétrico e suas Partes',
  XVII: 'Material de Transporte',
  XVIII: 'Instrumentos e Aparelhos de Óptica, de Fotografia, Cinematografia, de Medida, de Controle ou de Precisão; Instrumentos e Aparelhos Médico-Cirúrgicos; Relógios; Instrumentos Musicais',
  XIX: 'Armas e Munições; suas Partes e Acessórios',
  XX: 'Mercadorias e Produtos Diversos',
  XXI: 'Objetos de Arte, de Coleção e Antiguidades',
};

/* ─── Fases de transição ─── */
interface TransitionPhase {
  phase: string;
  icmsIssActive: string;
  ibsCbsActive: string;
  note: string;
}

/**
 * Cronograma de transição conforme LC 214/2025:
 * 2026-2027 — Fase de teste (IBS 0,1% / CBS 0,9%), ICMS/ISS integrais
 * 2028      — Início da transição: IBS sobe, ICMS começa a cair
 * 2029-2032 — Redução progressiva de ICMS/ISS (90%→80%→70%→60%)
 *             com elevação proporcional de IBS/CBS
 * 2033      — Extinção do ICMS/ISS; IBS e CBS em alíquotas plenas
 */
function getTransitionPhase(year: string): TransitionPhase {
  const y = parseInt(year, 10);
  if (!y || y < 2026) return { phase: EMPTY, icmsIssActive: EMPTY, ibsCbsActive: EMPTY, note: '' };

  if (y === 2026) return {
    phase: 'Fase 1: Teste e Ajuste',
    icmsIssActive: 'Sim (100%)',
    ibsCbsActive: 'Sim (alíquota-teste)',
    note: 'IBS a 0,1% e CBS a 0,9% para validação; ICMS/ISS permanecem integrais.',
  };
  if (y === 2027) return {
    phase: 'Fase 1: Teste e Ajuste',
    icmsIssActive: 'Sim (100%)',
    ibsCbsActive: 'Sim (alíquota-teste)',
    note: 'Último ano de teste. IBS e CBS ainda com alíquotas reduzidas; ICMS/ISS integrais.',
  };
  if (y === 2028) return {
    phase: 'Fase 2: Transição Gradual',
    icmsIssActive: 'Sim (100%)',
    ibsCbsActive: 'Sim (parcial)',
    note: 'Primeiro ano de transição efetiva. IBS/CBS começam a subir; ICMS/ISS iniciam redução.',
  };
  if (y === 2029) return {
    phase: 'Fase 2: Transição Gradual',
    icmsIssActive: 'Sim (90%)',
    ibsCbsActive: 'Sim (10% da alíquota plena)',
    note: 'ICMS/ISS reduzidos a 90% das alíquotas originais; IBS/CBS a 10% da alíquota-referência.',
  };
  if (y === 2030) return {
    phase: 'Fase 2: Transição Gradual',
    icmsIssActive: 'Sim (80%)',
    ibsCbsActive: 'Sim (20% da alíquota plena)',
    note: 'ICMS/ISS reduzidos a 80%; IBS/CBS a 20% da alíquota-referência.',
  };
  if (y === 2031) return {
    phase: 'Fase 2: Transição Gradual',
    icmsIssActive: 'Sim (70%)',
    ibsCbsActive: 'Sim (30% da alíquota plena)',
    note: 'ICMS/ISS reduzidos a 70%; IBS/CBS a 30% da alíquota-referência.',
  };
  if (y === 2032) return {
    phase: 'Fase 2: Transição Gradual',
    icmsIssActive: 'Sim (60%)',
    ibsCbsActive: 'Sim (40% da alíquota plena)',
    note: 'ICMS/ISS reduzidos a 60%; IBS/CBS a 40% da alíquota-referência. Último ano com coexistência.',
  };
  /* 2033 em diante — extinção */
  return {
    phase: 'Fase 3: Extinção ICMS/ISS',
    icmsIssActive: 'Não',
    ibsCbsActive: 'Sim (100% — alíquota plena)',
    note: 'ICMS e ISS extintos. IBS e CBS passam a vigorar com alíquotas plenas de referência.',
  };
}

/* ─── Interface auxiliar para dados cClassTrib parseados ─── */
interface ParsedCclass {
  cstIbsCbs: string;
  cstDescription: string;
  cClassTrib: string;
  name: string;
  description: string;
  rateType: string;
  pRedIBS: number;
  pRedCBS: number;
  lcArticle: string;
  lcText: string;
  indTribRegular: boolean;
  indCredPres: boolean;
  indMonoPadrao: boolean;
  indEstornoCred: boolean;
  indNFe: boolean;
  indNFCe: boolean;
  indNFSe: boolean;
  link: string;
}

function parseCclassRow(rowData: Record<string, unknown>): ParsedCclass {
  const s = (key: string) => String(rowData[key] ?? '').trim();
  const n = (key: string) => Number(rowData[key]) || 0;
  const b = (key: string) => Number(rowData[key]) === 1;
  return {
    cstIbsCbs: s('CST-IBS/CBS'),
    cstDescription: s('Descrição CST-IBS/CBS'),
    cClassTrib: s('cClassTrib'),
    name: s('Nome cClassTrib'),
    description: s('Descrição cClassTrib'),
    rateType: s('Tipo de Alíquota'),
    pRedIBS: n('pRedIBS'),
    pRedCBS: n('pRedCBS'),
    lcArticle: s('LC 214/25'),
    lcText: s('LC Redação'),
    indTribRegular: b('ind_gTribRegular'),
    indCredPres: b('ind_gCredPresOper'),
    indMonoPadrao: b('ind_gMonoPadrao'),
    indEstornoCred: b('ind_gEstornoCred'),
    indNFe: b('indNFe'),
    indNFCe: b('indNFCe'),
    indNFSe: b('indNFSe'),
    link: s('Link'),
  };
}

/* ─── NCM hierarchy result ─── */
interface NcmHierarchy {
  code: string;
  exactMatch?: NcmRowEntity;
  closestParent?: NcmRowEntity;
  chapterRow?: NcmRowEntity;
  headingRow?: NcmRowEntity;
  sectionCode: string;
  sectionName: string;
}

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(Lc214ChunkEntity)
    private readonly lcRepo: Repository<Lc214ChunkEntity>,
    @InjectRepository(NcmRowEntity)
    private readonly ncmRepo: Repository<NcmRowEntity>,
    @InjectRepository(CclassTribRowEntity)
    private readonly cclassRepo: Repository<CclassTribRowEntity>,
    @InjectRepository(SearchResultCacheEntity)
    private readonly searchCache: Repository<SearchResultCacheEntity>,
    private readonly siscomex: SiscomexService,
  ) {}

  async analyze(dto: AnalyzeDto): Promise<AnalyzeResponseDto> {
    const searchText = this.buildSearchTextForSources(dto);
    if (searchText.length < 2) {
      throw new BadRequestException(
        'Informe código NCM (mínimo 2 dígitos) ou termo adicional de consulta (mínimo 2 caracteres).',
      );
    }

    const displayQuery = this.normalizeDisplayQuery(dto);
    const normalized = searchText.toLowerCase();
    const queryKey = createHash('sha256')
      .update(`analyze:v4:${normalized}|regime:${(dto.regime ?? '').trim()}|year:${(dto.year ?? '').trim()}`)
      .digest('hex');

    const hit = await this.searchCache.findOne({ where: { queryKey } });
    if (hit?.payload && typeof hit.payload === 'object') {
      const p = hit.payload as AnalyzeResponseDto;
      return { ...p, cached: true };
    }

    const ncmDigits = (dto.ncm ?? '').replace(/\D/g, '').slice(0, 8);

    /* 1. Resolver hierarquia NCM */
    const ncmHierarchy = await this.resolveNcmHierarchy(ncmDigits);

    /* 2. Buscar cClassTrib — por dígitos NCM e depois por keywords da descrição */
    const cclassEntities = await this.findCclassMatches(normalized, ncmHierarchy);

    /* 3. Buscar LC 214 */
    const lcMatches = await this.lcRepo
      .createQueryBuilder('c')
      .where('LOWER(c.text) LIKE :q', { q: `%${this.escapeLike(normalized)}%` })
      .orderBy('c.chunkIndex', 'ASC')
      .take(4)
      .getMany();

    /* 4. Montar a view com dados estruturados */
    const view = this.buildView(ncmHierarchy, cclassEntities, lcMatches, dto);

    const response: AnalyzeResponseDto = { query: displayQuery, cached: false, view };

    await this.searchCache.save(
      this.searchCache.create({ queryKey, payload: response, updatedAt: new Date() }),
    );

    return response;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Resolução de hierarquia NCM
     ═══════════════════════════════════════════════════════════════════ */

  private async resolveNcmHierarchy(ncmDigits: string): Promise<NcmHierarchy> {
    const chapter2 = ncmDigits.slice(0, 2);
    const sectionCode = NCM_SECTIONS[chapter2] ?? '';
    const sectionName = SECTION_NAMES[sectionCode] ?? '';

    const result: NcmHierarchy = { code: ncmDigits, sectionCode, sectionName };

    if (ncmDigits.length < 2) return result;

    /* Buscar match exato (8 dígitos) */
    if (ncmDigits.length === 8) {
      const exact = await this.ncmRepo.findOne({
        where: { ncmCode: ncmDigits },
      });
      if (exact && exact.description.trim()) {
        result.exactMatch = exact;
      }
    }

    /* Buscar pais, do mais específico ao mais genérico */
    const prefixes: string[] = [];
    for (let len = ncmDigits.length - 1; len >= 2; len--) {
      prefixes.push(ncmDigits.slice(0, len));
    }

    for (const prefix of prefixes) {
      const parent = await this.ncmRepo
        .createQueryBuilder('n')
        .where('n.ncmCode = :code', { code: prefix })
        .getOne();
      if (!parent) continue;

      if (!result.closestParent) result.closestParent = parent;

      const pLen = prefix.length;
      if (pLen === 4 && !result.headingRow) result.headingRow = parent;
      if (pLen === 2 && !result.chapterRow) result.chapterRow = parent;
    }

    return result;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Busca cClassTrib — por dígitos NCM + keywords da descrição NCM
     ═══════════════════════════════════════════════════════════════════ */

  private async findCclassMatches(
    normalized: string,
    ncmHierarchy: NcmHierarchy,
  ): Promise<CclassTribRowEntity[]> {
    /* Pass 1: buscar pelo texto normalizado no rowData */
    let matches = await this.cclassRepo
      .createQueryBuilder('r')
      .where('LOWER(CAST(r.rowData AS TEXT)) LIKE :q', { q: `%${this.escapeLike(normalized)}%` })
      .take(10)
      .getMany();

    if (matches.length > 0) return matches;

    /* Pass 2: usar keywords da descrição NCM — combinar para maior precisão */
    const descriptions = [
      ncmHierarchy.headingRow?.description,
      ncmHierarchy.closestParent?.description,
      ncmHierarchy.chapterRow?.description,
    ].filter((d): d is string => !!d && d.length > 3);

    const allKeywords = extractKeywordsUtil(descriptions.join(' '));

    /* Pass 2a: tentar pares de keywords (mais preciso) */
    if (allKeywords.length >= 2) {
      for (let i = 0; i < allKeywords.length - 1; i++) {
        for (let j = i + 1; j < allKeywords.length; j++) {
          const qb = this.cclassRepo.createQueryBuilder('r');
          qb.where('LOWER(CAST(r.rowData AS TEXT)) LIKE :q1', { q1: `%${this.escapeLike(allKeywords[i])}%` });
          qb.andWhere('LOWER(CAST(r.rowData AS TEXT)) LIKE :q2', { q2: `%${this.escapeLike(allKeywords[j])}%` });
          matches = await qb.take(10).getMany();
          if (matches.length > 0) return matches;
        }
      }
    }

    /* Pass 2b: keywords individuais (menos preciso, mas melhor que nada) */
    for (const kw of allKeywords) {
      matches = await this.cclassRepo
        .createQueryBuilder('r')
        .where('LOWER(CAST(r.rowData AS TEXT)) LIKE :q', { q: `%${this.escapeLike(kw)}%` })
        .take(10)
        .getMany();
      if (matches.length > 0) return matches;
    }

    /* Pass 3: fallback por capítulo NCM → termos de busca mapeados */
    const chapter2 = ncmHierarchy.code.slice(0, 2);
    const chapterTerms = NCM_CHAPTER_SEARCH_TERMS[chapter2];
    if (chapterTerms) {
      for (const term of chapterTerms) {
        matches = await this.cclassRepo
          .createQueryBuilder('r')
          .where('LOWER(CAST(r.rowData AS TEXT)) LIKE :q', { q: `%${this.escapeLike(term)}%` })
          .take(10)
          .getMany();
        if (matches.length > 0) return matches;
      }
    }

    return [];
  }

  /**
   * Extrai radicais de busca do texto NCM. Usa radicais de 4-6 chars
   * dos termos de domínio para maximizar matches no cClassTrib
   * (ex.: "medicina" → "medic", "médico-cirúrgicos" → "médic", "cirúrg").
   */
  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
      'ou', 'e', 'a', 'o', 'os', 'as', 'um', 'uma', 'para', 'por',
      'com', 'que', 'se', 'não', 'são', 'como', 'mais', 'mas', 'ao',
      'aos', 'às', 'pelo', 'pela', 'outros', 'outras', 'exceto', 'etc',
      'fins', 'venda', 'retalho', 'apresentados', 'acondicionados',
      'constituídos', 'preparados', 'produtos', 'posições', 'incluindo',
      'suas', 'seus', 'partes', 'acessórios', 'aparelhos', 'instrumentos',
      'obras', 'artigos', 'demais', 'tipos', 'modo', 'geral', 'caso',
      'inclusive', 'mesmo', 'quando', 'ainda', 'também', 'sendo', 'sobre',
      'testes', 'visuais', 'destinados', 'entre', 'está', 'estes',
      'este', 'esta', 'estas', 'essa', 'isso', 'aqui', 'ação',
      'bem', 'cada', 'cuja', 'cujo', 'elas', 'eles', 'esse',
    ]);

    /**
     * Mapa de radicais NCM → termos que provavelmente existem no cClassTrib.
     * Quando uma palavra do NCM começa com um radical à esquerda, o termo
     * à direita é adicionado com prioridade máxima.
     */
    const stemToSearchTerm: [string, string][] = [
      ['medicament', 'medicament'],
      ['medicin', 'médic'],
      ['médic', 'médic'],
      ['farmac', 'medicament'],
      ['dispositiv', 'dispositiv'],
      ['vacin', 'medicament'],
      ['imunológ', 'medicament'],
      ['imunolog', 'medicament'],
      ['antissoro', 'medicament'],
      ['terapêut', 'medicament'],
      ['profilát', 'medicament'],
      ['diagnóst', 'medicament'],
      ['soro', 'medicament'],
      ['aliment', 'aliment'],
      ['bebida', 'bebida'],
      ['combust', 'combust'],
      ['veícul', 'veícul'],
      ['automotiv', 'automotiv'],
      ['agríc', 'agríc'],
      ['energia', 'energia'],
      ['elétric', 'elétric'],
      ['transport', 'transport'],
      ['educaç', 'educaç'],
      ['saúde', 'saúde'],
      ['mineral', 'mineral'],
      ['químic', 'químic'],
      ['têxtil', 'têxtil'],
      ['plástic', 'plástic'],
      ['borracha', 'borracha'],
      ['papel', 'papel'],
      ['calçad', 'calçad'],
      ['couro', 'couro'],
      ['vidro', 'vidro'],
      ['cimento', 'cimento'],
      ['cirurg', 'médic'],
      ['odontol', 'médic'],
      ['veterin', 'médic'],
      ['óptica', 'médic'],
      ['pecuár', 'agropecuário'],
      ['agropecu', 'agropecuário'],
      ['rebanho', 'agropecuário'],
      ['imóve', 'imóve'],
      ['imóvel', 'imóvel'],
    ];

    const words = text
      .toLowerCase()
      .replace(/[(),.;:!?\-–—]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    const unique = [...new Set(words)];

    /* Coletar termos de busca mapeados (alta prioridade) */
    const mapped = new Set<string>();
    for (const word of unique) {
      for (const [stem, searchTerm] of stemToSearchTerm) {
        if (word.startsWith(stem) || word.includes(stem)) {
          mapped.add(searchTerm);
        }
      }
    }

    /* Resultado: mapeados primeiro, depois os originais como fallback */
    const result = [...mapped];
    for (const w of unique) {
      if (result.length >= 8) break;
      if (!result.includes(w)) result.push(w);
    }

    return result.slice(0, 8);
  }

  /* ═══════════════════════════════════════════════════════════════════
     Montagem da view — dados estruturados
     ═══════════════════════════════════════════════════════════════════ */

  private buildView(
    ncm: NcmHierarchy,
    cclassEntities: CclassTribRowEntity[],
    lcMatches: Lc214ChunkEntity[],
    dto: AnalyzeDto,
  ): TaxAnalysisViewDto {
    const bestCclass = this.pickBestCclass(cclassEntities);
    const parsed = bestCclass ? parseCclassRow(bestCclass.rowData as Record<string, unknown>) : null;

    /* ─── Produto ─── */
    const ncmDesc = ncm.exactMatch?.description
      ?? ncm.closestParent?.description
      ?? EMPTY;
    const headingDesc = ncm.headingRow?.description ?? '';
    const chapterDesc = ncm.chapterRow?.description?.replace(/\.$/, '') ?? '';
    const chapter2 = ncm.code.slice(0, 2);
    const heading4 = ncm.code.slice(0, 4);

    const sectionLabel = ncm.sectionCode && ncm.sectionName
      ? `${ncm.sectionCode} - ${ncm.sectionName}`
      : EMPTY;

    const product: ProductPanelDto = {
      ncm: ncm.code || EMPTY,
      description: headingDesc || ncmDesc || EMPTY,
      sheetDescription: ncmDesc || EMPTY,
      category: chapterDesc || EMPTY,
      chapter: chapterDesc
        ? `${chapter2} - ${chapterDesc}`
        : EMPTY,
      section: sectionLabel,
    };

    /* ─── Classificação tributária (cClassTrib) ─── */
    const cclass: CclassPanelDto = parsed
      ? {
          cstIbsCbs: parsed.cstIbsCbs,
          cstDescription: parsed.cstDescription,
          cClassTrib: parsed.cClassTrib,
          ruleName: parsed.name,
          rateType: parsed.pRedIBS > 0 ? 'Reduzida' : parsed.rateType,
          ibsReduction: parsed.pRedIBS > 0 ? `${parsed.pRedIBS}%` : EMPTY,
          cbsReduction: parsed.pRedCBS > 0 ? `${parsed.pRedCBS}%` : EMPTY,
          lcArticle: parsed.lcArticle || EMPTY,
          lcText: parsed.lcText || EMPTY,
        }
      : {
          cstIbsCbs: EMPTY,
          cstDescription: EMPTY,
          cClassTrib: EMPTY,
          ruleName: EMPTY,
          rateType: EMPTY,
          ibsReduction: EMPTY,
          cbsReduction: EMPTY,
          lcArticle: EMPTY,
          lcText: EMPTY,
        };

    /* ─── Alíquotas efetivas ─── */
    const pRedIBS = parsed?.pRedIBS ?? 0;
    const pRedCBS = parsed?.pRedCBS ?? 0;
    const effIBS = REF_IBS_RATE * (1 - pRedIBS / 100);
    const effCBS = REF_CBS_RATE * (1 - pRedCBS / 100);

    const rates: EffectiveRatesPanelDto = parsed
      ? {
          ibs: effIBS > 0 ? `Sim (${(effIBS * 100).toFixed(2)}%)` : 'Isento',
          cbs: effCBS > 0 ? `Sim (${(effCBS * 100).toFixed(2)}%)` : 'Isento',
          selective: 'Não',
        }
      : { ibs: EMPTY, cbs: EMPTY, selective: EMPTY };

    /* ─── Classificações possíveis ─── */
    const possibleClassifications: PossibleClassificationDto[] = cclassEntities
      .map((e, i) => {
        const p = parseCclassRow(e.rowData as Record<string, unknown>);
        return {
          id: String(i + 1),
          label: p.name,
          cClassTrib: p.cClassTrib,
          cst: p.cstIbsCbs,
          rateType: p.pRedIBS > 0 ? 'Reduzida' : p.rateType,
          ibsReduction: p.pRedIBS > 0 ? `${p.pRedIBS}%` : EMPTY,
          cbsReduction: p.pRedCBS > 0 ? `${p.pRedCBS}%` : EMPTY,
          lcArticle: p.lcArticle || EMPTY,
        };
      })
      .slice(0, 6);

    /* ─── Regime, créditos e transição ─── */
    const regimeType = (dto.regime ?? '').trim().toLowerCase() || EMPTY;
    const yearStr = (dto.year ?? '').trim();
    const isLucroReal = /lucro\s*real/i.test(regimeType);

    const creditsType = isLucroReal ? 'integral' : EMPTY;
    const creditsEstimated = isLucroReal ? `R$ ${SIM_PURCHASE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : EMPTY;

    const transition = getTransitionPhase(yearStr);

    const regimeCreditsTransition: RegimeCreditsTransitionDto = {
      regime: {
        type: regimeType !== EMPTY ? regimeType : EMPTY,
        note: regimeType !== EMPTY
          ? `Regime de apuração de impostos sobre o ${regimeType} da empresa.`
          : 'Parâmetros de regime e créditos calculados no servidor conforme LC 214 e cClassTrib quando regras estiverem parametrizadas.',
      },
      credits: {
        type: creditsType,
        estimated: creditsEstimated,
        note: isLucroReal
          ? 'Crédito integral de IBS e CBS sobre o valor da compra para empresas do Lucro Real.'
          : 'Estimativa depende do cenário fiscal e do período de transição (ano de competência).',
      },
      transition: {
        year: yearStr || EMPTY,
        phase: transition.phase,
        icmsIssActive: transition.icmsIssActive,
        ibsCbsActive: transition.ibsCbsActive,
        note: transition.note || 'Fases de transição (IBS/CBS vs ICMS/ISS) seguem anexos e cronogramas da LC 214 para o ano indicado.',
      },
    };

    /* ─── Indicadores de grupo ─── */
    const groupIndicators: GroupIndicatorsDto = {
      items: [
        { label: 'Tributação regular', active: parsed?.indTribRegular ?? false },
        { label: 'Crédito presumido', active: parsed?.indCredPres ?? false },
        { label: 'Monofásico padrão', active: parsed?.indMonoPadrao ?? false },
        { label: 'Estorno de crédito', active: parsed?.indEstornoCred ?? false },
      ],
    };

    /* ─── Documentos fiscais ─── */
    const documents: FiscalDocumentsDto = parsed
      ? {
          nfe: parsed.indNFe,
          nfce: parsed.indNFCe,
          nfse: parsed.indNFSe,
          note: parsed.indNFe
            ? 'Emissão de Nota Fiscal Eletrônica (NF-e) para operações de venda de mercadorias.'
            : 'Aplicabilidade de NF-e / NFC-e / NFS-e conforme enquadramento.',
        }
      : {
          nfe: false,
          nfce: false,
          nfse: false,
          note: 'Aplicabilidade de NF-e / NFC-e / NFS-e conforme enquadramento (dados a consolidar nas próximas regras de motor fiscal).',
        };

    /* ─── Simulação tributária ─── */
    const simulation: TaxSimulationDto = parsed
      ? (() => {
          const ibsOnSale = SIM_SALE * effIBS;
          const cbsOnSale = SIM_SALE * effCBS;
          const ibsCredit = SIM_PURCHASE * effIBS;
          const cbsCredit = SIM_PURCHASE * effCBS;
          const finalTax = (ibsOnSale - ibsCredit) + (cbsOnSale - cbsCredit);
          const effectiveRate = SIM_SALE > 0 ? (finalTax / SIM_SALE) * 100 : 0;
          const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          return {
            purchase: fmt(SIM_PURCHASE),
            sale: fmt(SIM_SALE),
            ibsOnSale: fmt(ibsOnSale),
            cbsOnSale: fmt(cbsOnSale),
            ibsCredit: fmt(ibsCredit),
            cbsCredit: fmt(cbsCredit),
            finalTax: fmt(finalTax),
            effectiveRate: `${effectiveRate.toFixed(2)}%`,
          };
        })()
      : {
          purchase: EMPTY, sale: EMPTY, ibsOnSale: EMPTY, cbsOnSale: EMPTY,
          ibsCredit: EMPTY, cbsCredit: EMPTY, finalTax: EMPTY, effectiveRate: EMPTY,
        };

    /* ─── Análise estratégica ─── */
    const lcSummary = lcMatches.length > 0
      ? this.excerpt(lcMatches[0].text, ncm.code, 600)
      : '';

    const strategic: StrategicAnalysisDto = parsed
      ? {
          impact: parsed.pRedIBS > 0
            ? `Redução significativa da carga tributária de IBS/CBS devido à alíquota reduzida para ${parsed.name.toLowerCase().includes('medicam') ? 'medicamentos' : 'este segmento'}.`
            : lcSummary || 'Consolide o NCM com a classificação tributária (cClassTrib) e os dispositivos da LC 214 aplicáveis.',
          recommendation: parsed.lcArticle
            ? `Confirmar enquadramento conforme ${parsed.lcArticle} da LC 214 para garantir o benefício da redução de ${parsed.pRedIBS}%.`
            : 'Mantenha a classificação alinhada à tabela oficial e às notas técnicas vigentes.',
          risks: 'Possível reclassificação do produto ou alteração da legislação que afete a alíquota reduzida.',
        }
      : {
          impact: lcSummary || 'Consolide o NCM com a classificação tributária (cClassTrib) e os dispositivos da LC 214 aplicáveis ao setor e ao ano de competência.',
          recommendation: 'Mantenha a classificação alinhada à tabela oficial e às notas técnicas vigentes; valide cruzamentos com TIPI e regras da reforma.',
          risks: 'Classificação incorreta pode implicar tributação plena ou perda de benefícios; use sempre as fontes oficiais e a legislação atualizada.',
        };

    /* ─── Legal basis ─── */
    const legalBasisHint = parsed?.lcArticle
      ? `LC 214/2025, ${parsed.lcArticle} — consulte o texto legal para fundamentação completa.`
      : 'LC 214/2025 — consulte o texto legal para fundamentação completa.';

    /* ─── Links de referência ─── */
    const svrsUrl = ncm.code.length >= 8
      ? `https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributariaNcm?ncm=${ncm.code}&dfeTypes=NFE`
      : '';
    const siscomexUrl = `https://portalunico.siscomex.gov.br/classif/#/sumario?perfil=publico`;

    return {
      product,
      cclass,
      rates,
      possibleClassifications,
      regimeCreditsTransition,
      groupIndicators,
      documents,
      simulation,
      strategic,
      legalBasisHint,
      referenceLinks: {
        svrs: svrsUrl,
        siscomex: siscomexUrl,
      },
    };
  }

  /**
   * Escolhe a melhor entrada cClassTrib — prefere entradas com redução parcial (não zero) e não-genéricas.
   * A 200032 (medicamentos registrados na Anvisa, redução 60%) tem prioridade sobre 200009 (alíquota zero).
   */
  /**
   * Escolhe a melhor entrada cClassTrib usando pontuação:
   * - CST 200 (alíquota reduzida) >>> CST 000 (integral) >>> outros (suspensão, imunidade, etc.)
   * - Redução parcial (60%) > alíquota zero (100%) > sem redução (0%)
   * - Nomes mais específicos ganham
   */
  private pickBestCclass(entities: CclassTribRowEntity[]): CclassTribRowEntity | undefined {
    if (entities.length === 0) return undefined;
    if (entities.length === 1) return entities[0];

    const scored = entities.map((e) => {
      const d = e.rowData as Record<string, unknown>;
      const cst = String(d['CST-IBS/CBS'] ?? '');
      const pRed = Number(d['pRedIBS']) || 0;
      const name = String(d['Nome cClassTrib'] ?? '');

      let score = 0;

      /* CST type scoring: reduzida (200) is most useful, integral (000) is ok, others penalized */
      if (cst === '200') score += 20;
      else if (cst === '000') score += 10;
      else if (cst.startsWith('5') || cst.startsWith('4') || cst.startsWith('6') || cst.startsWith('8')) score -= 10;

      /* Reduction scoring: partial (60%) > zero (100%) > none (0%) */
      if (pRed > 0 && pRed < 100) score += 15;
      else if (pRed === 100) score += 8;
      else score += 3;

      /* Specificity bonus */
      if (name.length > 30) score += 2;

      return { entity: e, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].entity;
  }

  /* ═══════════════════════════════════════════════════════════════════
     Utilitários
     ═══════════════════════════════════════════════════════════════════ */

  private buildSearchTextForSources(dto: AnalyzeDto): string {
    const ncmDigits = (dto.ncm ?? '').replace(/\D/g, '').slice(0, 8);
    const free = (dto.query ?? '').trim();
    const parts: string[] = [];
    if (ncmDigits.length > 0) parts.push(ncmDigits);
    if (free.length > 0) parts.push(free);
    return parts.join(' ').trim();
  }

  private normalizeDisplayQuery(dto: AnalyzeDto): string {
    return [dto.ncm, dto.regime, dto.year, dto.query]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s) => s.length > 0)
      .join(' ')
      .trim();
  }

  private escapeLike(s: string): string {
    return s.replace(/[%_]/g, ' ');
  }

  private excerpt(text: string, highlight: string, max: number): string {
    const t = text.replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    const lower = t.toLowerCase();
    const h = highlight.toLowerCase();
    const idx = lower.indexOf(h.slice(0, Math.min(h.length, 12)));
    const start = idx >= 0 ? Math.max(0, idx - 40) : 0;
    return `${start > 0 ? '…' : ''}${t.slice(start, start + max)}${t.length > start + max ? '…' : ''}`;
  }

  private formatNcm(code: string): string {
    const d = code.replace(/\D/g, '');
    if (d.length !== 8) return code;
    return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  }
}
