import { Colors } from '@/constants/Colors'
import { Tokens } from '@/constants/Tokens'

/**
 * Injeta cores e tokens de tipografia em variáveis CSS no :root.
 * Hex apenas em `Colors.ts`; aqui só mapeamento `--app-*`.
 */
export function applyTheme(): void {
  const root = document.documentElement

  root.style.setProperty('--app-background', Colors.background)
  root.style.setProperty('--app-background-muted', Colors.backgroundMuted)
  root.style.setProperty('--app-background-gradient-end', Colors.backgroundGradientEnd)
  root.style.setProperty('--app-foreground', Colors.foreground)
  root.style.setProperty('--app-card', Colors.card)
  root.style.setProperty('--app-card-foreground', Colors.cardForeground)
  root.style.setProperty('--app-border', Colors.border)
  root.style.setProperty('--app-muted-foreground', Colors.mutedForeground)

  root.style.setProperty('--app-primary', Colors.primary)
  root.style.setProperty('--app-primary-foreground', Colors.primaryForeground)
  root.style.setProperty('--app-secondary', Colors.secondary)
  root.style.setProperty('--app-secondary-foreground', Colors.secondaryForeground)

  root.style.setProperty('--app-accent', Colors.accent)
  root.style.setProperty('--app-accent-foreground', Colors.accentForeground)

  root.style.setProperty('--app-chart-primary', Colors.chartPrimary)
  root.style.setProperty('--app-chart-secondary', Colors.chartSecondary)
  root.style.setProperty('--app-chart-grid', Colors.chartGrid)

  root.style.setProperty('--app-dark-background', Colors.darkBackground)
  root.style.setProperty('--app-dark-foreground', Colors.darkForeground)
  root.style.setProperty('--app-dark-card', Colors.darkCard)
  root.style.setProperty('--app-dark-border', Colors.darkBorder)
  root.style.setProperty('--app-dark-muted-foreground', Colors.darkMutedForeground)
  root.style.setProperty('--app-dark-chart-grid', Colors.darkChartGrid)

  root.style.setProperty('--app-font-sans', Tokens.fontFamily.sans)
  root.style.setProperty('--app-font-mono', Tokens.fontFamily.mono)

  root.style.setProperty('--app-text-xs', Tokens.fontSize.xs)
  root.style.setProperty('--app-text-sm', Tokens.fontSize.sm)
  root.style.setProperty('--app-text-base', Tokens.fontSize.base)
  root.style.setProperty('--app-text-lg', Tokens.fontSize.lg)
  root.style.setProperty('--app-text-xl', Tokens.fontSize.xl)
  root.style.setProperty('--app-text-2xl', Tokens.fontSize['2xl'])
  root.style.setProperty('--app-text-3xl', Tokens.fontSize['3xl'])

  root.style.setProperty('--app-font-weight-normal', Tokens.fontWeight.normal)
  root.style.setProperty('--app-font-weight-medium', Tokens.fontWeight.medium)
  root.style.setProperty('--app-font-weight-semibold', Tokens.fontWeight.semibold)
  root.style.setProperty('--app-font-weight-bold', Tokens.fontWeight.bold)

  root.style.setProperty('--app-leading-tight', Tokens.lineHeight.tight)
  root.style.setProperty('--app-leading-snug', Tokens.lineHeight.snug)
  root.style.setProperty('--app-leading-normal', Tokens.lineHeight.normal)

  root.style.setProperty('--app-tracking-tight', Tokens.letterSpacing.tight)
  root.style.setProperty('--app-tracking-normal', Tokens.letterSpacing.normal)
  root.style.setProperty('--app-tracking-wide', Tokens.letterSpacing.wide)
}
