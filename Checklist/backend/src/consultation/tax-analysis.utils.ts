/**
 * Pure utility functions shared between single-query ConsultationService
 * and batch BatchService. No DB dependencies — operates on in-memory data.
 */
import type { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';
import type { NcmRowEntity } from '../entities/ncm-row.entity';

export const EMPTY = '—';
export const REF_IBS_RATE = 0.001; // 0.1%
export const REF_CBS_RATE = 0.009; // 0.9%

/* ─── Seções NCM ─── */
export const NCM_SECTIONS: Record<string, string> = {
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

export const SECTION_NAMES: Record<string, string> = {
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

/* ─── Parsed cClassTrib ─── */
export interface ParsedCclass {
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

export function parseCclassRow(rowData: Record<string, unknown>): ParsedCclass {
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

/* ─── NCM Hierarchy ─── */
export interface NcmHierarchy {
  code: string;
  exactMatch?: NcmRowEntity;
  closestParent?: NcmRowEntity;
  chapterRow?: NcmRowEntity;
  headingRow?: NcmRowEntity;
  sectionCode: string;
  sectionName: string;
}

/** Resolve NCM hierarchy from an in-memory Map (no DB). */
export function resolveNcmHierarchyFromMap(
  ncmDigits: string,
  ncmMap: Map<string, NcmRowEntity>,
): NcmHierarchy {
  const chapter2 = ncmDigits.slice(0, 2);
  const sectionCode = NCM_SECTIONS[chapter2] ?? '';
  const sectionName = SECTION_NAMES[sectionCode] ?? '';
  const result: NcmHierarchy = { code: ncmDigits, sectionCode, sectionName };

  if (ncmDigits.length < 2) return result;

  /* Exact match */
  if (ncmDigits.length === 8) {
    const exact = ncmMap.get(ncmDigits);
    if (exact && exact.description.trim()) result.exactMatch = exact;
  }

  /* Walk up parents */
  for (let len = ncmDigits.length - 1; len >= 2; len--) {
    const prefix = ncmDigits.slice(0, len);
    const parent = ncmMap.get(prefix);
    if (!parent) continue;
    if (!result.closestParent) result.closestParent = parent;
    if (prefix.length === 4 && !result.headingRow) result.headingRow = parent;
    if (prefix.length === 2 && !result.chapterRow) result.chapterRow = parent;
  }

  return result;
}

/* ─── Keyword extraction ─── */

const STOP_WORDS = new Set([
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

const STEM_TO_SEARCH: [string, string][] = [
  /* Farmacêutico / Médico */
  ['medicament', 'medicament'], ['medicin', 'médic'], ['médic', 'médic'],
  ['farmac', 'medicament'], ['dispositiv', 'dispositiv'],
  ['cirurg', 'médic'], ['odontol', 'médic'], ['veterin', 'médic'], ['óptica', 'médic'],
  ['vacin', 'medicament'], ['imunológ', 'medicament'], ['imunolog', 'medicament'],
  ['antissoro', 'medicament'], ['terapêut', 'medicament'], ['profilát', 'medicament'],
  ['diagnóst', 'medicament'], ['soro', 'medicament'],
  /* Alimentos / Agropecuária */
  ['aliment', 'aliment'], ['comestív', 'aliment'], ['carne', 'agropecuário'],
  ['miudeza', 'agropecuário'], ['peixe', 'agropecuário'], ['pescad', 'agropecuário'],
  ['leite', 'aliment'], ['lacticín', 'aliment'], ['ovos', 'aliment'],
  ['fruta', 'aliment'], ['legum', 'aliment'], ['cereal', 'aliment'],
  ['hortal', 'aliment'], ['cacau', 'aliment'], ['café', 'aliment'],
  ['açúcar', 'aliment'], ['bovino', 'agropecuário'],
  ['suíno', 'agropecuário'], ['caprino', 'agropecuário'], ['aves', 'agropecuário'],
  ['cavalo', 'agropecuário'], ['equino', 'agropecuário'], ['asinino', 'agropecuário'],
  ['pecuár', 'agropecuário'], ['agropecu', 'agropecuário'], ['rebanho', 'agropecuário'],
  /* Bebidas / Combustíveis / Veículos */
  ['bebida', 'bebida'], ['combust', 'combust'], ['veícul', 'veícul'],
  ['automotiv', 'automotiv'],
  /* Energia / Infraestrutura */
  ['energia', 'energia'], ['elétric', 'elétric'], ['transport', 'transport'],
  ['educaç', 'educaç'], ['saúde', 'saúde'],
  /* Minerais / Químicos / Materiais */
  ['mineral', 'mineral'], ['químic', 'químic'], ['têxtil', 'têxtil'],
  ['plástic', 'plástic'], ['borracha', 'borracha'], ['papel', 'papel'],
  ['calçad', 'calçad'], ['couro', 'couro'], ['vidro', 'vidro'],
  ['cimento', 'cimento'], ['cerâmic', 'cerâmic'], ['madeira', 'madeira'],
  /* Imóveis */
  ['imóve', 'imóve'], ['imóvel', 'imóvel'],
];

/**
 * Mapeamento direto NCM capítulo (2 dígitos) → termos de busca cClassTrib.
 * Quando o keyword extraction falha, usa o capítulo para buscar diretamente.
 */
export const NCM_CHAPTER_SEARCH_TERMS: Record<string, string[]> = {
  '01': ['agropecuário', 'animal'],
  '02': ['agropecuário', 'aliment'],
  '03': ['agropecuário', 'aliment'],
  '04': ['agropecuário', 'aliment'],
  '05': ['agropecuário'],
  '06': ['agropecuário'],
  '07': ['aliment', 'agropecuário'],
  '08': ['aliment', 'agropecuário'],
  '09': ['aliment'],
  '10': ['aliment', 'agropecuário'],
  '11': ['aliment'],
  '12': ['agropecuário'],
  '13': ['agropecuário'],
  '14': ['agropecuário'],
  '15': ['aliment'],
  '16': ['aliment'],
  '17': ['aliment'],
  '18': ['aliment'],
  '19': ['aliment'],
  '20': ['aliment'],
  '21': ['aliment'],
  '22': ['bebida'],
  '23': ['agropecuário'],
  '24': ['aliment'],
  '25': ['mineral'],
  '26': ['mineral'],
  '27': ['combust', 'energia'],
  '28': ['químic'],
  '29': ['químic'],
  '30': ['medicament', 'médic'],
  '31': ['agropecuário', 'insumo'],
  '33': ['higiene'],
  '38': ['químic'],
  '39': ['integralmente'],
  '40': ['integralmente'],
  '44': ['madeira', 'integralmente'],
  '45': ['integralmente'],
  '46': ['integralmente'],
  '47': ['papel', 'integralmente'],
  '48': ['papel', 'integralmente'],
  '49': ['integralmente'],
  '50': ['têxtil', 'integralmente'],
  '51': ['têxtil', 'integralmente'],
  '52': ['têxtil', 'integralmente'],
  '53': ['têxtil', 'integralmente'],
  '54': ['têxtil', 'integralmente'],
  '55': ['têxtil', 'integralmente'],
  '56': ['têxtil', 'integralmente'],
  '57': ['têxtil', 'integralmente'],
  '58': ['têxtil', 'integralmente'],
  '59': ['têxtil', 'integralmente'],
  '60': ['têxtil', 'integralmente'],
  '61': ['têxtil', 'integralmente'],
  '62': ['têxtil', 'integralmente'],
  '63': ['têxtil', 'integralmente'],
  '64': ['calçad', 'integralmente'],
  '65': ['calçad', 'integralmente'],
  '66': ['integralmente'],
  '67': ['integralmente'],
  '68': ['cerâmic', 'integralmente'],
  '69': ['cerâmic', 'integralmente'],
  '70': ['vidro', 'integralmente'],
  '71': ['integralmente'],
  '72': ['integralmente'],
  '73': ['integralmente'],
  '74': ['integralmente'],
  '75': ['integralmente'],
  '76': ['integralmente'],
  '78': ['integralmente'],
  '79': ['integralmente'],
  '80': ['integralmente'],
  '81': ['integralmente'],
  '82': ['integralmente'],
  '83': ['integralmente'],
  '84': ['máquina', 'integralmente'],
  '85': ['elétric', 'integralmente'],
  '86': ['transport', 'integralmente'],
  '87': ['automotiv', 'veícul', 'integralmente'],
  '88': ['transport', 'integralmente'],
  '89': ['transport', 'integralmente'],
  '90': ['médic', 'dispositiv', 'integralmente'],
  '91': ['integralmente'],
  '92': ['integralmente'],
  '93': ['integralmente'],
  '94': ['integralmente'],
  '95': ['integralmente'],
  '96': ['integralmente'],
  '97': ['integralmente'],
};

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[(),.;:!?\-–—]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));

  const unique = [...new Set(words)];
  const mapped = new Set<string>();
  for (const word of unique) {
    for (const [stem, searchTerm] of STEM_TO_SEARCH) {
      if (word.startsWith(stem) || word.includes(stem)) {
        mapped.add(searchTerm);
      }
    }
  }

  const result = [...mapped];
  for (const w of unique) {
    if (result.length >= 8) break;
    if (!result.includes(w)) result.push(w);
  }
  return result.slice(0, 8);
}

/* ─── In-memory cClassTrib matching ─── */

function escapeLike(s: string): string {
  return s.toLowerCase().replace(/[%_]/g, ' ');
}

function rowDataText(entity: CclassTribRowEntity): string {
  return JSON.stringify(entity.rowData).toLowerCase();
}

export function findCclassMatchesInMemory(
  ncmDigits: string,
  ncmHierarchy: NcmHierarchy,
  allCclass: CclassTribRowEntity[],
  /** Pre-computed lowercase JSON strings for each entity */
  cclassTexts?: string[],
): CclassTribRowEntity[] {
  const texts = cclassTexts ?? allCclass.map(rowDataText);
  const normalized = ncmDigits.toLowerCase();

  /* Pass 1: exact match on NCM digits in rowData */
  const pass1 = allCclass.filter((_, i) => texts[i].includes(escapeLike(normalized)));
  if (pass1.length > 0) return pass1.slice(0, 10);

  /* Pass 2: keywords from NCM descriptions */
  const descriptions = [
    ncmHierarchy.headingRow?.description,
    ncmHierarchy.closestParent?.description,
    ncmHierarchy.chapterRow?.description,
  ].filter((d): d is string => !!d && d.length > 3);

  const keywords = extractKeywords(descriptions.join(' '));

  /* Pass 2a: pairs */
  if (keywords.length >= 2) {
    for (let i = 0; i < keywords.length - 1; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const k1 = escapeLike(keywords[i]);
        const k2 = escapeLike(keywords[j]);
        const matches = allCclass.filter((_, idx) => texts[idx].includes(k1) && texts[idx].includes(k2));
        if (matches.length > 0) return matches.slice(0, 10);
      }
    }
  }

  /* Pass 2b: single keywords */
  for (const kw of keywords) {
    const k = escapeLike(kw);
    const matches = allCclass.filter((_, idx) => texts[idx].includes(k));
    if (matches.length > 0) return matches.slice(0, 10);
  }

  /* Pass 3: fallback to NCM chapter → cClassTrib mapping */
  const chapter2 = ncmDigits.slice(0, 2);
  const chapterTerms = NCM_CHAPTER_SEARCH_TERMS[chapter2];
  if (chapterTerms) {
    for (const term of chapterTerms) {
      const k = escapeLike(term);
      const matches = allCclass.filter((_, idx) => texts[idx].includes(k));
      if (matches.length > 0) return matches.slice(0, 10);
    }
  }

  return [];
}

/* ─── Best cClassTrib picker ─── */

export function pickBestCclass(entities: CclassTribRowEntity[]): CclassTribRowEntity | undefined {
  if (entities.length === 0) return undefined;
  if (entities.length === 1) return entities[0];

  const scored = entities.map((e) => {
    const d = e.rowData as Record<string, unknown>;
    const cst = String(d['CST-IBS/CBS'] ?? '');
    const pRed = Number(d['pRedIBS']) || 0;
    const name = String(d['Nome cClassTrib'] ?? '');

    let score = 0;
    if (cst === '200') score += 20;
    else if (cst === '000') score += 10;
    else if (cst.startsWith('5') || cst.startsWith('4') || cst.startsWith('6') || cst.startsWith('8')) score -= 10;

    if (pRed > 0 && pRed < 100) score += 15;
    else if (pRed === 100) score += 8;
    else score += 3;

    if (name.length > 30) score += 2;
    return { entity: e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].entity;
}
