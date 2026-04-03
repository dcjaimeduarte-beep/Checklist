/**
 * Paleta alinhada à identidade geométrica da logo (navy + teal, superfícies planas).
 * Única fonte de hex no frontend; não duplicar literais em componentes ou CSS.
 */
export const Colors = {
  /** Branco — base do documento e “negativo” da marca */
  background: '#FFFFFF',

  /** Cinza muito claro — áreas de apoio */
  backgroundMuted: '#F2F5F7',

  /** Fim do gradiente claro (branco → azul muito suave), ex.: login */
  backgroundGradientEnd: '#E8F0FA',

  /** Cartões e painéis sobre fundo neutro */
  card: '#FFFFFF',

  /** Texto principal (azul-cinza escuro) */
  foreground: '#1A2332',

  /** Texto em cartões */
  cardForeground: '#1A2332',

  /** Legendas e texto secundário */
  mutedForeground: '#5A6570',

  /** Divisórias */
  border: '#DDE4EA',

  /** Navy da marca — bloco principal da logo */
  primary: '#13293D',

  /** Texto sobre primary */
  primaryForeground: '#FFFFFF',

  /** Teal desaturado — acento e triângulo da logo */
  secondary: '#3E7080',

  /** Texto sobre secondary */
  secondaryForeground: '#FFFFFF',

  /** Destaques de UI — alinhado ao primary */
  accent: '#13293D',

  accentForeground: '#FFFFFF',

  /** Gráficos */
  chartPrimary: '#13293D',
  chartSecondary: '#3E7080',
  chartGrid: '#DDE4EA',

  /** Modo escuro (componentes que usam dark:) — tons da mesma família */
  darkBackground: '#0B2135',
  darkForeground: '#F2F5F7',
  darkCard: '#13293D',
  darkBorder: '#2A4A5C',
  darkMutedForeground: '#A8B4BC',
  darkChartGrid: '#3A5566',
} as const

export type ColorKey = keyof typeof Colors
