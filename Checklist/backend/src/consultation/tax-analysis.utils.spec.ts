import {
  EMPTY,
  REF_IBS_RATE,
  REF_CBS_RATE,
  NCM_SECTIONS,
  SECTION_NAMES,
  parseCclassRow,
  resolveNcmHierarchyFromMap,
  extractKeywords,
  findCclassMatchesInMemory,
  pickBestCclass,
} from './tax-analysis.utils';
import type { NcmRowEntity } from '../entities/ncm-row.entity';
import type { CclassTribRowEntity } from '../entities/cclass-trib-row.entity';

/* ─── Helpers to create test entities ─── */

function makeNcm(ncmCode: string, description: string): NcmRowEntity {
  return { id: ncmCode, ncmCode, description, rawRow: null } as NcmRowEntity;
}

function makeCclass(rowData: Record<string, unknown>): CclassTribRowEntity {
  return { id: '1', rowData } as CclassTribRowEntity;
}

function buildNcmMap(entries: NcmRowEntity[]): Map<string, NcmRowEntity> {
  const m = new Map<string, NcmRowEntity>();
  for (const e of entries) m.set(e.ncmCode, e);
  return m;
}

/* ─── Constants ─── */

describe('Constants', () => {
  it('EMPTY is em-dash', () => {
    expect(EMPTY).toBe('—');
  });

  it('REF rates are positive and small', () => {
    expect(REF_IBS_RATE).toBeCloseTo(0.001);
    expect(REF_CBS_RATE).toBeCloseTo(0.009);
  });

  it('NCM_SECTIONS covers chapter 30 → VI', () => {
    expect(NCM_SECTIONS['30']).toBe('VI');
  });

  it('NCM_SECTIONS covers chapter 90 → XVIII', () => {
    expect(NCM_SECTIONS['90']).toBe('XVIII');
  });

  it('SECTION_NAMES has all roman numerals I-XXI', () => {
    expect(Object.keys(SECTION_NAMES).length).toBe(21);
    expect(SECTION_NAMES['VI']).toContain('Químicas');
  });
});

/* ─── parseCclassRow ─── */

describe('parseCclassRow', () => {
  const row = {
    'CST-IBS/CBS': '200',
    'Descrição CST-IBS/CBS': 'Alíquota reduzida em 60%',
    'cClassTrib': '200032',
    'Nome cClassTrib': 'Medicamentos registrados na Anvisa',
    'Descrição cClassTrib': 'Fornecimento dos medicamentos...',
    'LC Redação': 'Art. 133. Ficam reduzidas...',
    'LC 214/25': 'Art. 133',
    'Tipo de Alíquota': 'Reduzida',
    'pRedIBS': 60,
    'pRedCBS': 60,
    'ind_gTribRegular': 0,
    'ind_gCredPresOper': 0,
    'ind_gMonoPadrao': 0,
    'ind_gEstornoCred': 0,
    'indNFe': 1,
    'indNFCe': 1,
    'indNFSe': 0,
    'Link': 'https://example.com',
  };

  it('parses string fields', () => {
    const p = parseCclassRow(row);
    expect(p.cstIbsCbs).toBe('200');
    expect(p.cClassTrib).toBe('200032');
    expect(p.name).toBe('Medicamentos registrados na Anvisa');
    expect(p.lcArticle).toBe('Art. 133');
  });

  it('parses numeric fields', () => {
    const p = parseCclassRow(row);
    expect(p.pRedIBS).toBe(60);
    expect(p.pRedCBS).toBe(60);
  });

  it('parses boolean indicator fields', () => {
    const p = parseCclassRow(row);
    expect(p.indNFe).toBe(true);
    expect(p.indNFCe).toBe(true);
    expect(p.indNFSe).toBe(false);
    expect(p.indTribRegular).toBe(false);
  });

  it('handles missing fields gracefully', () => {
    const p = parseCclassRow({});
    expect(p.cstIbsCbs).toBe('');
    expect(p.pRedIBS).toBe(0);
    expect(p.indNFe).toBe(false);
  });
});

/* ─── resolveNcmHierarchyFromMap ─── */

describe('resolveNcmHierarchyFromMap', () => {
  const ncmMap = buildNcmMap([
    makeNcm('30', 'Produtos farmacêuticos.'),
    makeNcm('3004', 'Medicamentos para fins terapêuticos ou profiláticos.'),
    makeNcm('300490', ''),
    makeNcm('3004909', ''),
    makeNcm('30049099', 'Outros'),
  ]);

  it('resolves exact 8-digit match', () => {
    const h = resolveNcmHierarchyFromMap('30049099', ncmMap);
    expect(h.exactMatch?.ncmCode).toBe('30049099');
    expect(h.code).toBe('30049099');
  });

  it('resolves heading (4-digit)', () => {
    const h = resolveNcmHierarchyFromMap('30049090', ncmMap);
    expect(h.headingRow?.ncmCode).toBe('3004');
    expect(h.headingRow?.description).toContain('Medicamentos');
  });

  it('resolves chapter (2-digit)', () => {
    const h = resolveNcmHierarchyFromMap('30049090', ncmMap);
    expect(h.chapterRow?.ncmCode).toBe('30');
    expect(h.chapterRow?.description).toContain('farmacêuticos');
  });

  it('resolves section code and name', () => {
    const h = resolveNcmHierarchyFromMap('30049090', ncmMap);
    expect(h.sectionCode).toBe('VI');
    expect(h.sectionName).toContain('Químicas');
  });

  it('resolves closest parent when no exact match', () => {
    const h = resolveNcmHierarchyFromMap('30049090', ncmMap);
    expect(h.exactMatch).toBeUndefined();
    expect(h.closestParent?.ncmCode).toBe('3004909');
  });

  it('returns empty hierarchy for short code', () => {
    const h = resolveNcmHierarchyFromMap('3', ncmMap);
    expect(h.headingRow).toBeUndefined();
    expect(h.chapterRow).toBeUndefined();
  });
});

/* ─── extractKeywords ─── */

describe('extractKeywords', () => {
  it('extracts domain keywords from NCM description', () => {
    const kws = extractKeywords('Medicamentos para fins terapêuticos ou profiláticos');
    expect(kws).toContain('medicament');
  });

  it('maps cirurgia to médic', () => {
    const kws = extractKeywords('Instrumentos e aparelhos para medicina, cirurgia, odontologia e veterinária');
    expect(kws).toContain('médic');
  });

  it('filters stopwords', () => {
    const kws = extractKeywords('Produtos de venda para fins de retalho');
    expect(kws).not.toContain('de');
    expect(kws).not.toContain('para');
    expect(kws).not.toContain('fins');
  });

  it('returns max 8 keywords', () => {
    const kws = extractKeywords(
      'medicamentos farmacêuticos dispositivos médicos alimentação bebidas combustíveis veículos automotivos agrícolas energia elétrica transporte',
    );
    expect(kws.length).toBeLessThanOrEqual(8);
  });

  it('handles empty input', () => {
    expect(extractKeywords('')).toEqual([]);
  });
});

/* ─── findCclassMatchesInMemory ─── */

describe('findCclassMatchesInMemory', () => {
  const medicCclass = makeCclass({
    'CST-IBS/CBS': '200',
    'Nome cClassTrib': 'Fornecimento dos medicamentos registrados na Anvisa',
    'cClassTrib': '200032',
    'pRedIBS': 60,
    'pRedCBS': 60,
  });

  const genericCclass = makeCclass({
    'CST-IBS/CBS': '000',
    'Nome cClassTrib': 'Situações tributadas integralmente',
    'cClassTrib': '000001',
    'pRedIBS': 0,
    'pRedCBS': 0,
  });

  const allCclass = [medicCclass, genericCclass];
  const texts = allCclass.map((e) => JSON.stringify(e.rowData).toLowerCase());

  const ncmMap = buildNcmMap([
    makeNcm('30', 'Produtos farmacêuticos.'),
    makeNcm('3004', 'Medicamentos para fins terapêuticos.'),
  ]);

  it('finds cClassTrib by keyword from NCM description', () => {
    const hierarchy = resolveNcmHierarchyFromMap('30049090', ncmMap);
    const matches = findCclassMatchesInMemory('30049090', hierarchy, allCclass, texts);
    expect(matches.length).toBeGreaterThan(0);
    const names = matches.map((m) => (m.rowData as Record<string, unknown>)['Nome cClassTrib']);
    expect(names).toContain('Fornecimento dos medicamentos registrados na Anvisa');
  });

  it('returns empty for unmatched NCM', () => {
    const emptyMap = buildNcmMap([]);
    const hierarchy = resolveNcmHierarchyFromMap('99999999', emptyMap);
    const matches = findCclassMatchesInMemory('99999999', hierarchy, allCclass, texts);
    expect(matches).toEqual([]);
  });
});

/* ─── pickBestCclass ─── */

describe('pickBestCclass', () => {
  it('returns undefined for empty array', () => {
    expect(pickBestCclass([])).toBeUndefined();
  });

  it('returns single element', () => {
    const e = makeCclass({ 'CST-IBS/CBS': '200', 'pRedIBS': 60, 'Nome cClassTrib': 'Test' });
    expect(pickBestCclass([e])).toBe(e);
  });

  it('prefers CST 200 with partial reduction over CST 000', () => {
    const reduced = makeCclass({ 'CST-IBS/CBS': '200', 'pRedIBS': 60, 'Nome cClassTrib': 'Medicamentos Anvisa redução 60%' });
    const integral = makeCclass({ 'CST-IBS/CBS': '000', 'pRedIBS': 0, 'Nome cClassTrib': 'Tributação integral' });
    const best = pickBestCclass([integral, reduced]);
    expect((best?.rowData as Record<string, unknown>)['CST-IBS/CBS']).toBe('200');
  });

  it('prefers partial reduction (60%) over full reduction (100%)', () => {
    const partial = makeCclass({ 'CST-IBS/CBS': '200', 'pRedIBS': 60, 'Nome cClassTrib': 'Redução parcial de medicamentos' });
    const full = makeCclass({ 'CST-IBS/CBS': '200', 'pRedIBS': 100, 'Nome cClassTrib': 'Alíquota zero' });
    const best = pickBestCclass([full, partial]);
    expect((best?.rowData as Record<string, unknown>)['pRedIBS']).toBe(60);
  });

  it('penalizes suspension CST (5xx)', () => {
    const suspension = makeCclass({ 'CST-IBS/CBS': '550', 'pRedIBS': 0, 'Nome cClassTrib': 'Zona de exportação' });
    const integral = makeCclass({ 'CST-IBS/CBS': '000', 'pRedIBS': 0, 'Nome cClassTrib': 'Tributação integral' });
    const best = pickBestCclass([suspension, integral]);
    expect((best?.rowData as Record<string, unknown>)['CST-IBS/CBS']).toBe('000');
  });
});
