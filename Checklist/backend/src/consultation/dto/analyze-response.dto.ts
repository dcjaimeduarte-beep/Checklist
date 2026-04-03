import type { TaxAnalysisViewDto } from './tax-analysis-view.dto';

export interface AnalyzeResponseDto {
  /** Texto canónico usado na pesquisa e no cache */
  query: string;
  cached: boolean;
  /** Dados já resolvidos para a UI — sem cálculo no cliente */
  view: TaxAnalysisViewDto;
}
