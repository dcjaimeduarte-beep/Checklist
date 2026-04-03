import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import {
  Loader2, LogOut, Search, FileSpreadsheet,
  Database, BookOpen, Scale, TrendingUp,
  ExternalLink, Sparkles, PlayCircle, X, RefreshCw,
} from 'lucide-react'
import { usePage } from '@/App'

import { AnalysisViewDisplay } from '@/components/analysis/AnalysisViewDisplay'
import { AppLogo } from '@/components/AppLogo'
import { useAuth } from '@/auth/AuthContext'
import { useConsult } from '@/consultation/ConsultContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dropdown } from '@/components/ui/Dropdown'
import { analyzeRequest } from '@/lib/api'

const regimeOptions = [
  { value: '', label: 'Selecione…' },
  { value: 'lucro_real', label: 'Lucro real' },
  { value: 'lucro_presumido', label: 'Lucro presumido' },
  { value: 'simples_nacional', label: 'Simples Nacional' },
]

const yearOptions = [
  { value: '2026', label: '2026' }, { value: '2027', label: '2027' },
  { value: '2028', label: '2028' }, { value: '2029', label: '2029' },
  { value: '2030', label: '2030' }, { value: '2031', label: '2031' },
  { value: '2032', label: '2032' }, { value: '2033', label: '2033' },
]

const ALL_QUICK_NCMS = [
  { ncm: '30049090', label: 'Medicamentos', desc: 'Outros medicamentos para venda a retalho' },
  { ncm: '02013000', label: 'Carnes', desc: 'Carnes desossadas de bovino, frescas/refrigeradas' },
  { ncm: '84713012', label: 'Notebooks', desc: 'Máquinas de processamento de dados portáteis' },
  { ncm: '61091000', label: 'Vestuário', desc: 'Camisetas de malha de algodão' },
  { ncm: '22021000', label: 'Bebidas', desc: 'Águas com adição de açúcar ou edulcorantes' },
  { ncm: '87032100', label: 'Veículos', desc: 'Automóveis de passageiros até 1.000 cm³' },
  { ncm: '85171200', label: 'Smartphones', desc: 'Telefones celulares e para redes sem fio' },
  { ncm: '94017900', label: 'Móveis', desc: 'Assentos com armação de metal' },
  { ncm: '73239300', label: 'Utensílios', desc: 'Artigos de uso doméstico em aço inox' },
  { ncm: '04012110', label: 'Leite', desc: 'Leite UHT com teor de gordura 1-6%' },
  { ncm: '64039990', label: 'Calçados', desc: 'Calçados com sola de borracha ou plástico' },
  { ncm: '39241000', label: 'Plásticos', desc: 'Serviços de mesa e utensílios de plástico' },
  { ncm: '33049990', label: 'Cosméticos', desc: 'Produtos de beleza e maquiagem' },
  { ncm: '19053100', label: 'Alimentos', desc: 'Biscoitos e bolachas doces' },
  { ncm: '27101259', label: 'Combustíveis', desc: 'Gasolina para motores' },
  { ncm: '90183900', label: 'Seringas', desc: 'Agulhas, cateteres e instrumentos médicos' },
  { ncm: '48189090', label: 'Papéis', desc: 'Papel higiênico e artigos de higiene' },
  { ncm: '71131100', label: 'Joias', desc: 'Artefatos de joalheria de prata' },
]

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Persiste entre mounts — sobrevive navegação entre páginas
const rotatingState = {
  items: shuffleArray(ALL_QUICK_NCMS).slice(0, 6),
  nextRotateAt: Date.now() + 300_000,
}

function useRotatingNcms(count: number, intervalMs: number) {
  const [items, setItems] = useState(rotatingState.items)
  const [fading, setFading] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((rotatingState.nextRotateAt - Date.now()) / 1000)),
  )
  const tickRef = useRef<ReturnType<typeof setInterval>>()
  const spinTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const doRotate = useCallback(() => {
    setSpinning(true)
    clearTimeout(spinTimerRef.current)
    spinTimerRef.current = setTimeout(() => setSpinning(false), 800)
    setFading(true)
    setTimeout(() => {
      const next = shuffleArray(ALL_QUICK_NCMS).slice(0, count)
      rotatingState.items = next
      rotatingState.nextRotateAt = Date.now() + intervalMs
      setItems(next)
      setFading(false)
    }, 400)
  }, [count, intervalMs])

  useEffect(() => {
    // Sincroniza com o estado global ao montar
    setItems(rotatingState.items)

    tickRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((rotatingState.nextRotateAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        rotatingState.nextRotateAt = Date.now() + intervalMs
        const next = shuffleArray(ALL_QUICK_NCMS).slice(0, count)
        rotatingState.items = next
        setItems(next)
        setSpinning(true)
        clearTimeout(spinTimerRef.current)
        spinTimerRef.current = setTimeout(() => setSpinning(false), 800)
        setFading(true)
        setTimeout(() => setFading(false), 400)
      }
    }, 1000)

    return () => { clearInterval(tickRef.current); clearTimeout(spinTimerRef.current) }
  }, [count, intervalMs])

  const rotateNow = useCallback(() => {
    doRotate()
  }, [doRotate])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return { items, fading, spinning, secondsLeft, formatTime, rotateNow }
}

/* ── Dashboard empty state ── */
function DashboardHome({ onAnalyzeNcm, analyzingNcm }: { onAnalyzeNcm: (ncm: string) => void; analyzingNcm: string | null }) {
  const { items, fading, spinning, secondsLeft, formatTime, rotateNow } = useRotatingNcms(6, 300_000)

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Database, label: 'Códigos NCM', value: '15.156', accent: 'bg-[#13293D]/5 text-[#13293D]' },
          { icon: Scale, label: 'Classificações cClassTrib', value: '154', accent: 'bg-[#3E7080]/5 text-[#3E7080]' },
          { icon: BookOpen, label: 'Base Legal', value: 'LC 214', accent: 'bg-blue-50 text-blue-600' },
          { icon: TrendingUp, label: 'Fase Atual', value: '2026', accent: 'bg-emerald-50 text-emerald-600' },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="rounded-xl bg-white border border-border p-4 flex items-center gap-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent.split(' ')[0]}`}>
              <Icon className={`h-5 w-5 ${accent.split(' ').slice(1).join(' ')}`} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[20px] font-bold text-foreground leading-none tabular-nums">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Consultas rápidas */}
        <div className="lg:col-span-8">
          <div className="rounded-xl bg-white border border-border overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-secondary" aria-hidden />
              <h3 className="text-[13px] font-semibold text-foreground">Consultas rápidas</h3>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">{formatTime(secondsLeft)}</span>
                <button
                  type="button"
                  onClick={rotateNow}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-background-muted/60 transition-colors cursor-pointer"
                  title="Atualizar sugestões"
                >
                  <RefreshCw className={`h-3 w-3 transition-transform duration-700 ${spinning ? 'animate-spin' : ''}`} aria-hidden />
                  Atualizar
                </button>
              </div>
            </div>
            <div className={`divide-y divide-border transition-opacity duration-400 ${fading ? 'opacity-0' : 'opacity-100'}`}>
              {items.map(({ ncm, label, desc }) => {
                const isLoading = analyzingNcm === ncm
                return (
                  <button
                    key={ncm}
                    type="button"
                    disabled={!!analyzingNcm}
                    onClick={() => onAnalyzeNcm(ncm)}
                    className="flex items-center gap-4 w-full px-5 py-3 text-left hover:bg-background-muted/50 transition-colors cursor-pointer group disabled:opacity-60 disabled:cursor-wait"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/8">
                      <span className="text-[11px] font-bold text-secondary font-mono">{ncm.slice(0, 4)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-foreground">{label}</p>
                        <span className="text-[11px] text-muted-foreground font-mono">{ncm}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium shrink-0 transition-all ${
                      isLoading
                        ? 'bg-secondary/10 text-secondary'
                        : 'bg-primary text-white'
                    }`}>
                      {isLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                          Analisando...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-3 w-3" aria-hidden />
                          Analisar
                        </>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Transição */}
          <div className="rounded-xl bg-white border border-border p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">Cronograma de transição</h3>
            <div className="space-y-2">
              {[
                { year: '2026-2027', phase: 'Teste', desc: 'IBS 0,1% + CBS 0,9%', active: true },
                { year: '2028', phase: 'Início', desc: 'Transição gradual' },
                { year: '2029-2032', phase: 'Redução', desc: 'ICMS/ISS reduzindo' },
                { year: '2033+', phase: 'Extinção', desc: 'IBS/CBS plenos' },
              ].map(({ year, phase, desc, active }) => (
                <div key={year} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${active ? 'bg-secondary/5 ring-1 ring-secondary/20' : 'bg-background-muted/50'}`}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${active ? 'bg-secondary' : 'bg-border'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-foreground">{year} <span className="font-normal text-muted-foreground">— {phase}</span></p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Links de referência */}
          <div className="rounded-xl bg-white border border-border p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">Referências</h3>
            <div className="space-y-2">
              {[
                { label: 'Portal SVRS', desc: 'Classificação tributária oficial', url: 'https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributariaNcm' },
                { label: 'Siscomex', desc: 'Nomenclatura NCM', url: 'https://portalunico.siscomex.gov.br/classif/#/sumario?perfil=publico' },
              ].map(({ label, desc, url }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background-muted/50 transition-colors cursor-pointer group"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-secondary shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ConsultPage() {
  const { logout } = useAuth()
  const { setPage } = usePage()
  const { ncm, setNcm, regime, setRegime, year, setYear, result, setResult } = useConsult()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [analyzingQuickNcm, setAnalyzingQuickNcm] = useState<string | null>(null)

  async function doAnalyze(targetNcm: string, targetRegime?: string, targetYear?: string) {
    setErr(null)
    const digits = targetNcm.trim().replace(/\D/g, '')
    if (digits.length < 2) {
      setErr(`NCM deve ter no mínimo 2 dígitos (você digitou ${digits.length || 0}). Exemplo: 30049090`)
      return
    }
    if (digits.length !== 8 && digits.length !== 4 && digits.length !== 2) {
      setErr(`NCM deve ter 2, 4 ou 8 dígitos (você digitou ${digits.length}). Exemplo: 30049090`)
      return
    }

    setLoading(true)
    try {
      const data = await analyzeRequest({
        ncm: digits,
        regime: targetRegime || regime || undefined,
        year: targetYear || year || undefined,
      })
      setResult(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha na análise.'
      setErr(msg)
      if (msg.includes('Sessão expirada') || msg.includes('Volte a entrar')) {
        await logout()
      }
    } finally {
      setLoading(false)
      setAnalyzingQuickNcm(null)
    }
  }

  async function onAnalyze(e: FormEvent) {
    e.preventDefault()
    await doAnalyze(ncm)
  }

  async function handleQuickAnalyze(quickNcm: string) {
    setNcm(quickNcm)
    if (!regime) setRegime('lucro_real')
    if (!year) setYear('2026')
    setAnalyzingQuickNcm(quickNcm)
    await doAnalyze(quickNcm, regime || 'lucro_real', year || '2026')
  }

  function handleBackToHome() {
    setResult(null)
    setNcm('')
    setErr(null)
  }

  return (
    <div className="min-h-svh bg-background-muted flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo imgClassName="h-7 sm:h-8" />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:block min-w-0">
              <h1 className="text-[13px] font-semibold text-foreground truncate leading-tight">Análise Tributária</h1>
              <p className="text-[10px] text-muted-foreground">LC 214/2025</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Search className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Consulta</span>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage('lote')}>
              <FileSpreadsheet className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Lote</span>
            </Button>
            <div className="h-5 w-px bg-border" />
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="sticky top-[45px] z-20 border-b border-border bg-white">
        <form onSubmit={onAnalyze} className="mx-auto max-w-[1400px] px-4 py-3 lg:px-6">
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
            <div className="col-span-2 sm:w-[170px] space-y-1">
              <label htmlFor="ncm" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">NCM</label>
              <Input
                id="ncm" inputMode="numeric" autoComplete="off" placeholder="XXXXXXXX"
                value={ncm} onChange={(e) => setNcm(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="h-[38px] font-mono text-[13px] placeholder:text-muted-foreground/40"
              />
            </div>
            <div className="col-span-1 sm:w-[170px] space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Regime</label>
              <Dropdown id="regime" options={regimeOptions} value={regime} onChange={setRegime} placeholder="Selecione…" />
            </div>
            <div className="col-span-1 sm:w-[100px] space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ano</label>
              <Dropdown id="year" options={yearOptions} value={year} onChange={setYear} />
            </div>
            <div className="col-span-2 sm:col-span-1 flex gap-2">
              <Button type="submit" disabled={loading} className="h-[38px] flex-1 sm:flex-none sm:px-6 gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
                {loading ? 'Analisando…' : 'Analisar'}
              </Button>
              {result && (
                <Button type="button" variant="outline" onClick={handleBackToHome} className="h-[38px] gap-1.5 sm:px-4">
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Limpar
                </Button>
              )}
            </div>
          </div>
          {err && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">
              <Search className="h-3.5 w-3.5 text-red-400 shrink-0" aria-hidden />
              <p className="text-xs text-red-700">{err}</p>
            </div>
          )}
        </form>
      </div>

      {/* Content */}
      <div className="flex-1 mx-auto w-full max-w-[1400px] px-3 sm:px-4 py-4 lg:px-6">
        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{result.query}</span>
                {result.cached && (
                  <span className="rounded border border-border bg-white px-1 py-px text-[9px] font-medium">cache</span>
                )}
                {result.view?.referenceLinks?.svrs && (
                  <a
                    href={result.view.referenceLinks.svrs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded border border-border bg-white px-1.5 py-px text-[9px] font-medium hover:bg-background-muted cursor-pointer transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                    SVRS
                  </a>
                )}
              </div>
            </div>
            <AnalysisViewDisplay view={result.view} />
          </div>
        ) : (
          <DashboardHome onAnalyzeNcm={handleQuickAnalyze} analyzingNcm={analyzingQuickNcm} />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-white py-3 px-4 lg:px-6 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Seven Sistemas de Automações. Todos os direitos reservados.
      </footer>
    </div>
  )
}
