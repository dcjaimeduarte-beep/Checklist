/**
 * Payload de exibição da análise — montado apenas no backend (serviço).
 * O frontend replica a forma para tipagem; não recalcula valores.
 */
export interface ProductPanelDto {
  ncm: string;
  description: string;
  sheetDescription: string;
  category: string;
  chapter: string;
  section: string;
}

export interface CclassPanelDto {
  cstIbsCbs: string;
  cstDescription: string;
  cClassTrib: string;
  ruleName: string;
  rateType: string;
  ibsReduction: string;
  cbsReduction: string;
  lcArticle: string;
  lcText: string;
}

export interface EffectiveRatesPanelDto {
  ibs: string;
  cbs: string;
  selective: string;
}

export interface PossibleClassificationDto {
  id: string;
  label: string;
  cClassTrib: string;
  cst: string;
  rateType: string;
  ibsReduction: string;
  cbsReduction: string;
  lcArticle: string;
}

export interface RegimeCreditsTransitionDto {
  regime: { type: string; note: string };
  credits: { type: string; estimated: string; note: string };
  transition: {
    year: string;
    phase: string;
    icmsIssActive: string;
    ibsCbsActive: string;
    note: string;
  };
}

export interface GroupIndicatorItemDto {
  label: string;
  active: boolean;
}

export interface GroupIndicatorsDto {
  items: GroupIndicatorItemDto[];
}

export interface FiscalDocumentsDto {
  nfe: boolean;
  nfce: boolean;
  nfse: boolean;
  note: string;
}

export interface TaxSimulationDto {
  purchase: string;
  sale: string;
  ibsOnSale: string;
  cbsOnSale: string;
  ibsCredit: string;
  cbsCredit: string;
  finalTax: string;
  effectiveRate: string;
}

export interface StrategicAnalysisDto {
  impact: string;
  recommendation: string;
  risks: string;
}

export interface TaxAnalysisViewDto {
  product: ProductPanelDto;
  cclass: CclassPanelDto;
  rates: EffectiveRatesPanelDto;
  possibleClassifications: PossibleClassificationDto[];
  regimeCreditsTransition: RegimeCreditsTransitionDto;
  groupIndicators: GroupIndicatorsDto;
  documents: FiscalDocumentsDto;
  simulation: TaxSimulationDto;
  strategic: StrategicAnalysisDto;
  legalBasisHint: string;
  referenceLinks?: {
    svrs: string;
    siscomex: string;
  };
}
