/**
 * Tipografia — stack profissional para sistema web (Inter como principal; fallbacks sistema).
 * Carregamento de Inter em `index.html` (Google Fonts).
 */
export const Tokens = {
  fontFamily: {
    sans: [
      '"Inter"',
      'Roboto',
      '"Public Sans"',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ].join(', '),
    mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'].join(
      ', ',
    ),
  },

  /** Tamanhos em rem */
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },

  /** Tamanhos em px — Recharts e libs que exigem número */
  fontSizePx: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0em',
    wide: '0.05em',
  },
} as const
