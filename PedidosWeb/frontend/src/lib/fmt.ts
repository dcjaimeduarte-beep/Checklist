export function fmtMoeda(v: number | undefined | null): string {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtData(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  if (d) return `${d}/${m}/${y}`
  return s
}

export function fmtCpfCnpj(v?: string): string {
  if (!v) return '—'
  const n = v.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}
