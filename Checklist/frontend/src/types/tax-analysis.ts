/**
 * Espelha o contrato `TaxAnalysisViewDto` da API (`POST /consultation/analyze`).
 * Valores e textos vêm do backend — não recalcular nem inferir regra fiscal no cliente.
 */
export type ProductPanel = {
  ncm: string
  description: string
  sheetDescription: string
  category: string
  chapter: string
  section: string
}

export type CclassPanel = {
  cstIbsCbs: string
  cstDescription: string
  cClassTrib: string
  ruleName: string
  rateType: string
  ibsReduction: string
  cbsReduction: string
  lcArticle: string
  lcText: string
}

export type EffectiveRatesPanel = {
  ibs: string
  cbs: string
  selective: string
}

export type PossibleClassification = {
  id: string
  label: string
  cClassTrib: string
  cst: string
  rateType: string
  ibsReduction: string
  cbsReduction: string
  lcArticle: string
}

export type RegimeCreditsTransition = {
  regime: { type: string; note: string }
  credits: { type: string; estimated: string; note: string }
  transition: {
    year: string
    phase: string
    icmsIssActive: string
    ibsCbsActive: string
    note: string
  }
}

export type GroupIndicators = {
  items: Array<{ label: string; active: boolean }>
}

export type FiscalDocuments = {
  nfe: boolean
  nfce: boolean
  nfse: boolean
  note: string
}

export type TaxSimulation = {
  purchase: string
  sale: string
  ibsOnSale: string
  cbsOnSale: string
  ibsCredit: string
  cbsCredit: string
  finalTax: string
  effectiveRate: string
}

export type StrategicAnalysis = {
  impact: string
  recommendation: string
  risks: string
}

/** Vista completa para o dashboard pós-login */
export type TaxAnalysisView = {
  product: ProductPanel
  cclass: CclassPanel
  rates: EffectiveRatesPanel
  possibleClassifications: PossibleClassification[]
  regimeCreditsTransition: RegimeCreditsTransition
  groupIndicators: GroupIndicators
  documents: FiscalDocuments
  simulation: TaxSimulation
  strategic: StrategicAnalysis
  /** Referência textual à LC 214 (ex.: âncora ou trecho) */
  legalBasisHint: string
}
