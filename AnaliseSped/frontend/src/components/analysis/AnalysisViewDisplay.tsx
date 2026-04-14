import { useState } from 'react'
import {
  Check, X, Package, Tag, Percent, List, Building2, Coins,
  CalendarClock, ToggleLeft, FileText, Calculator, TrendingUp,
  Scale, ChevronDown, ChevronRight, BookOpen, BarChart3, Shield, Layers,
  ExternalLink,
} from 'lucide-react'

import type { TaxAnalysisView } from '@/types/tax-analysis'

type Props = { view: TaxAnalysisView }

/* ─── Primitives ─── */

function SectionHeader({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent?: 'navy' | 'teal' }) {
  const colors = accent === 'navy'
    ? 'bg-primary/5 text-primary'
    : accent === 'teal'
      ? 'bg-secondary/8 text-secondary'
      : 'bg-secondary/8 text-secondary'
  return (
    <div className="flex items-center gap-2.5 mb-3.5">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${colors}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <h3 className="text-[13px] font-semibold text-foreground uppercase tracking-wide">{title}</h3>
    </div>
  )
}

function DataRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const isEmpty = !value || value === '—'
  return (
    <div className="flex items-start justify-between gap-3 py-[7px] border-b border-border/30 last:border-b-0">
      <span className="text-[13px] text-muted-foreground shrink-0 leading-snug">{label}</span>
      <span className={`text-[13px] text-right leading-snug ${isEmpty ? 'text-muted-foreground/30' : 'text-foreground font-medium'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function Badge({ children, variant }: { children: React.ReactNode; variant: 'green' | 'red' | 'blue' | 'gray' }) {
  const styles = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    red: 'bg-red-50 text-red-600 border-red-200/80',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/80',
    gray: 'bg-gray-50 text-gray-400 border-gray-200/80',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${styles[variant]}`}>
      {children}
    </span>
  )
}

function BoolRow({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="flex items-center justify-between py-[7px] border-b border-border/30 last:border-b-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {value
        ? <Badge variant="green"><Check className="h-2.5 w-2.5" aria-hidden /> Sim</Badge>
        : <Badge variant="gray"><X className="h-2.5 w-2.5" aria-hidden /> Não</Badge>
      }
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: 'teal' | 'navy' }) {
  return (
    <div className={`rounded-lg border border-border/60 px-3 py-3 text-center ${
      accent === 'teal' ? 'bg-secondary/5' : accent === 'navy' ? 'bg-primary/5' : 'bg-background-muted/40'
    }`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums leading-none ${
        accent === 'teal' ? 'text-secondary' : accent === 'navy' ? 'text-primary' : 'text-foreground'
      }`}>{value}</p>
    </div>
  )
}

/* ─── Tabs ─── */

type TabId = 'overview' | 'tax' | 'classifications' | 'strategic'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { id: 'tax', label: 'Tributação', icon: Layers },
  { id: 'classifications', label: 'Classificações', icon: List },
  { id: 'strategic', label: 'Estratégica', icon: TrendingUp },
]

/* ─── Expandable Classification ─── */

function ExpandableClassification({ item, rank }: { item: Props['view']['possibleClassifications'][0]; rank: number }) {
  const [open, setOpen] = useState(false)
  const isFirst = rank === 0
  return (
    <div className={`rounded-lg border overflow-hidden ${isFirst ? 'border-secondary/30 ring-1 ring-secondary/10' : 'border-border/50'}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left cursor-pointer hover:bg-background-muted/40 transition-colors ${
          isFirst ? 'bg-secondary/[0.03]' : ''
        }`}
      >
        <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${
          isFirst ? 'bg-secondary text-white' : 'bg-secondary/10 text-secondary'
        }`}>
          {item.id}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium text-foreground leading-snug">{item.label}</p>
            {isFirst && <span className="text-[9px] font-semibold text-secondary bg-secondary/10 rounded px-1.5 py-px uppercase">Principal</span>}
          </div>
          <p className="text-[10px] text-muted-foreground mt-px font-mono">
            {item.cClassTrib} · CST {item.cst} · {item.ibsReduction || '—'} red.
          </p>
        </div>
        {open
          ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
          : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
        }
      </button>
      {open && (
        <div className="border-t border-border/40 bg-background-muted/20 px-4 py-2.5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            <div><span className="text-muted-foreground">Tipo: </span><span className="font-medium">{item.rateType || '—'}</span></div>
            <div><span className="text-muted-foreground">Artigo: </span><span className="font-medium">{item.lcArticle || '—'}</span></div>
            <div><span className="text-muted-foreground">Red. IBS: </span><span className="font-medium">{item.ibsReduction || '—'}</span></div>
            <div><span className="text-muted-foreground">Red. CBS: </span><span className="font-medium">{item.cbsReduction || '—'}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Visão Geral ─── */

function TabOverview({ view }: Props) {
  const { product, cclass, rates, simulation } = view
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-border bg-white p-5">
        <SectionHeader icon={Package} title="Produto" accent="navy" />
        <DataRow label="NCM" value={product.ncm} mono />
        <DataRow label="Descrição" value={product.description} />
        <DataRow label="Categoria" value={product.category} />
        <DataRow label="Capítulo" value={product.chapter} />
        <DataRow label="Seção" value={product.section} />
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <SectionHeader icon={Tag} title="Classificação" accent="teal" />
        <DataRow label="CST IBS/CBS" value={cclass.cstIbsCbs} mono />
        <DataRow label="Descrição CST" value={cclass.cstDescription} />
        <DataRow label="cClassTrib" value={cclass.cClassTrib} mono />
        <DataRow label="Regra" value={cclass.ruleName} />
        <DataRow label="Tipo alíquota" value={cclass.rateType} />
        <DataRow label="Red. IBS" value={cclass.ibsReduction} />
        <DataRow label="Red. CBS" value={cclass.cbsReduction} />
        <DataRow label="Artigo" value={cclass.lcArticle} />
        {cclass.lcText && cclass.lcText !== '—' && (
          <div className="mt-3 rounded-lg bg-background-muted border border-border/60 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <BookOpen className="h-2.5 w-2.5 text-secondary" aria-hidden />
              <span className="text-[9px] font-semibold text-secondary uppercase tracking-wider">Texto do artigo</span>
            </div>
            <p className="text-[10px] leading-relaxed text-foreground/70">{cclass.lcText}</p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionHeader icon={Percent} title="Alíquotas" accent="teal" />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="IBS" value={rates.ibs && rates.ibs !== '—' ? rates.ibs.replace('Sim ', '') : '—'} accent="navy" />
            <MiniStat label="CBS" value={rates.cbs && rates.cbs !== '—' ? rates.cbs.replace('Sim ', '') : '—'} accent="teal" />
            <MiniStat label="Seletivo" value={rates.selective || '—'} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <SectionHeader icon={Calculator} title="Simulação" accent="navy" />
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-primary/5 px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Compra</p>
              <p className="text-sm font-bold tabular-nums text-primary">{simulation.purchase || '—'}</p>
            </div>
            <div className="rounded-lg bg-secondary/5 px-3 py-2 text-center">
              <p className="text-[9px] text-muted-foreground uppercase">Venda</p>
              <p className="text-sm font-bold tabular-nums text-secondary">{simulation.sale || '—'}</p>
            </div>
          </div>
          <DataRow label="IBS s/ venda" value={simulation.ibsOnSale} />
          <DataRow label="CBS s/ venda" value={simulation.cbsOnSale} />
          <DataRow label="Créd. IBS" value={simulation.ibsCredit} />
          <DataRow label="Créd. CBS" value={simulation.cbsCredit} />
          <div className="border-t border-primary/10 mt-2 pt-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-[12px] font-semibold text-foreground">Imposto final</span>
              <span className="text-sm font-bold tabular-nums text-primary">{simulation.finalTax || '—'}</span>
            </div>
            <div className="flex items-center justify-between py-1 rounded-lg bg-secondary/5 px-2 -mx-2">
              <span className="text-[12px] font-semibold text-secondary">Carga efetiva</span>
              <span className="text-sm font-bold text-secondary tabular-nums">{simulation.effectiveRate || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Tab: Tributação ─── */

function TabTax({ view }: Props) {
  const { regimeCreditsTransition, groupIndicators, documents } = view
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {/* Regime + Créditos */}
      <div className="rounded-xl border border-border bg-white p-5">
        <SectionHeader icon={Building2} title="Regime" accent="navy" />
        <DataRow label="Tipo" value={regimeCreditsTransition.regime.type} />
        {regimeCreditsTransition.regime.note && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{regimeCreditsTransition.regime.note}</p>
        )}
        <div className="border-t border-border/40 my-3" />
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-secondary/8">
            <Coins className="h-3 w-3 text-secondary" aria-hidden />
          </div>
          <span className="text-[12px] font-semibold text-foreground">Créditos</span>
        </div>
        <DataRow label="Tipo" value={regimeCreditsTransition.credits.type} />
        <DataRow label="Estimado" value={regimeCreditsTransition.credits.estimated} />
        {regimeCreditsTransition.credits.note && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{regimeCreditsTransition.credits.note}</p>
        )}
      </div>

      {/* Transição */}
      <div className="rounded-xl border border-border bg-white p-5">
        <SectionHeader icon={CalendarClock} title="Transição" accent="teal" />
        <div className="grid grid-cols-2 gap-2 mb-3">
          <MiniStat label="Ano" value={regimeCreditsTransition.transition.year} accent="navy" />
          <MiniStat label="Fase" value={regimeCreditsTransition.transition.phase.replace('Fase ', '').split(':')[0] || '—'} accent="teal" />
        </div>
        <DataRow label="ICMS/ISS" value={regimeCreditsTransition.transition.icmsIssActive} />
        <DataRow label="IBS/CBS" value={regimeCreditsTransition.transition.ibsCbsActive} />
        {regimeCreditsTransition.transition.note && (
          <div className="mt-3 rounded-lg bg-secondary/5 border border-secondary/10 p-2.5">
            <p className="text-[10px] leading-relaxed text-foreground/70">{regimeCreditsTransition.transition.note}</p>
          </div>
        )}
      </div>

      {/* Indicadores + Documentos */}
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionHeader icon={ToggleLeft} title="Indicadores" accent="navy" />
          {groupIndicators.items.map(it => <BoolRow key={it.label} label={it.label} value={it.active} />)}
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <SectionHeader icon={FileText} title="Documentos" accent="teal" />
          <BoolRow label="NF-e" value={documents.nfe} />
          <BoolRow label="NFC-e" value={documents.nfce} />
          <BoolRow label="NFS-e" value={documents.nfse} />
          {documents.note && <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{documents.note}</p>}
        </div>
      </div>
    </div>
  )
}

/* ─── Tab: Classificações ─── */

function TabClassifications({ view }: Props) {
  const { possibleClassifications } = view
  if (possibleClassifications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white p-8 text-center">
        <List className="h-8 w-8 text-muted-foreground/15 mx-auto mb-3" aria-hidden />
        <p className="text-sm text-muted-foreground">Nenhuma classificação alternativa encontrada.</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader icon={List} title={`${possibleClassifications.length} classificação(ões)`} accent="teal" />
      </div>
      <div className="space-y-2">
        {possibleClassifications.map((p, i) => <ExpandableClassification key={p.id} item={p} rank={i} />)}
      </div>
    </div>
  )
}

/* ─── Tab: Estratégica ─── */

function TabStrategic({ view }: Props) {
  const { strategic, legalBasisHint, referenceLinks } = view
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <div className="rounded-xl bg-secondary/5 border border-secondary/15 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/10">
              <TrendingUp className="h-3 w-3 text-secondary" aria-hidden />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-secondary">Impacto</span>
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{strategic.impact}</p>
        </div>
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-3 w-3 text-primary" aria-hidden />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Recomendação</span>
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{strategic.recommendation}</p>
        </div>
        <div className="rounded-xl bg-amber-50/70 border border-amber-200/60 p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100">
              <Scale className="h-3 w-3 text-amber-600" aria-hidden />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Riscos</span>
          </div>
          <p className="text-[12px] leading-relaxed text-amber-900">{strategic.risks}</p>
        </div>
      </div>

      {/* Referências */}
      {referenceLinks?.svrs && (
        <div className="rounded-xl border border-border bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-foreground">Verificar no portal SVRS</p>
            <p className="text-[10px] text-muted-foreground">Classificação tributária oficial por NCM</p>
          </div>
          <a
            href={referenceLinks.svrs}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-medium text-white hover:bg-primary/90 cursor-pointer transition-colors"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Abrir SVRS
          </a>
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground/50">{legalBasisHint}</p>
    </div>
  )
}

/* ─── Main ─── */

export function AnalysisViewDisplay({ view }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { product, cclass, simulation } = view
  const hasReduction = cclass.ibsReduction && cclass.ibsReduction !== '—'

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-r from-[#13293D] to-[#1a3548] px-5 py-4 text-white">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'NCM', value: product.ncm?.length === 8 ? `${product.ncm.slice(0,4)}.${product.ncm.slice(4,6)}.${product.ncm.slice(6)}` : product.ncm, mono: true },
            { label: 'cClassTrib', value: cclass.cClassTrib, mono: true },
            { label: 'CST', value: cclass.cstIbsCbs },
            { label: 'Carga', value: simulation.effectiveRate },
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">{label}</p>
              <p className={`text-[17px] font-bold ${mono ? 'font-mono tracking-wide' : ''}`}>{value || '—'}</p>
            </div>
          ))}
        </div>
        {hasReduction && (
          <div className="mt-3 rounded-lg bg-white/8 px-3.5 py-2 flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden />
            <p className="text-[12px]">
              <span className="font-semibold text-emerald-300">-{cclass.ibsReduction}</span>
              <span className="text-white/40 mx-1.5">·</span>
              <span className="text-white/60">{cclass.ruleName}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-px rounded-xl bg-border/50 p-px">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium cursor-pointer transition-all ${
                active ? 'bg-white text-foreground shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <TabOverview view={view} />}
      {activeTab === 'tax' && <TabTax view={view} />}
      {activeTab === 'classifications' && <TabClassifications view={view} />}
      {activeTab === 'strategic' && <TabStrategic view={view} />}
    </div>
  )
}
