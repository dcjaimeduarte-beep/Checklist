import { useState } from 'react'
import {
  CheckCircle2,
  FileDown,
  Mail,
  AlertTriangle,
  ChevronLeft,
  FileText,
  FolderOpen,
  X,
  Loader2,
  ClipboardCheck,
  ShieldAlert,
  Search,
} from 'lucide-react'

import { useConfront } from '@/confront/ConfrontContext'
import { usePage } from '@/App'
import { downloadExcel, downloadPdf, sendEmailReport } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AuditItem, CancelamentoItem, CfopSummary, SpedItem, XmlItem } from '@/types/confront'

type TabId = 'auditoria' | 'dashboard' | 'cfop-agrupado' | 'resumo' | 'xml-sem-sped' | 'sped-sem-xml' | 'sem-autorizacao' | 'cancelamentos' | 'erros-leitura'

const CSTAT_LABEL: Record<string, string> = {
  '100': 'Autorizado',
  '150': 'Autorizado (dif. UF)',
  '101': 'Cancelado',
  '110': 'Uso Denegado',
  '135': 'Evento registrado',
  '155': 'Cancelamento homologado',
  '210': 'NF-e não localizada',
  '301': 'Denegado (emitente)',
  '302': 'Denegado (destinatário)',
  '999': 'Rejeição',
}

const SITUACAO_MAP: Record<string, { label: string; cls: string }> = {
  '00': { label: 'Regular',        cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  '01': { label: 'Regular (ext.)', cls: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  '02': { label: 'Cancelada',      cls: 'bg-amber-100  text-amber-700  ring-1 ring-amber-200'  },
  '03': { label: 'Canc. (ext.)',   cls: 'bg-amber-100  text-amber-700  ring-1 ring-amber-200'  },
  '04': { label: 'Denegada',       cls: 'bg-red-100    text-red-700    ring-1 ring-red-200'    },
  '06': { label: 'Complementar',   cls: 'bg-blue-100   text-blue-700   ring-1 ring-blue-200'   },
  '07': { label: 'Canc. ext.',     cls: 'bg-amber-100  text-amber-700  ring-1 ring-amber-200'  },
  '08': { label: 'Devolução',      cls: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' },
}

const MODELO_MAP: Record<string, string> = {
  '55': 'NF-e',
  '65': 'NFC-e',
  '57': 'CT-e',
  '67': 'CT-e OS',
}

const TIPO_CLS: Record<string, string> = {
  'NFe':   'bg-primary/10  text-primary  ring-1 ring-primary/20',
  'NFC-e': 'bg-secondary/10 text-secondary ring-1 ring-secondary/20',
  'CTe':   'bg-indigo-100  text-indigo-700 ring-1 ring-indigo-200',
}

/** Gera nome de arquivo: {NomeEmpresa}_{MM-AAAA}.{ext} */
function buildFilename(nome: string, dtIni: string, ext: string): string {
  const nomeSanitizado = nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
  const mes = dtIni.length >= 8 ? `${dtIni.slice(2, 4)}-${dtIni.slice(4, 8)}` : dtIni
  return `${nomeSanitizado}_${mes}.${ext}`
}

function formatDate(dt?: string): string {
  if (!dt) return '—'
  if (dt.includes('T') || dt.includes('-')) return new Date(dt).toLocaleDateString('pt-BR')
  if (dt.length === 8) return `${dt.slice(0, 2)}/${dt.slice(2, 4)}/${dt.slice(4, 8)}`
  return dt
}

function SituacaoBadge({ codSit }: { codSit?: string }) {
  const info = SITUACAO_MAP[codSit ?? ''] ?? { label: codSit ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', info.cls)}>{info.label}</span>
}

function TipoBadge({ tipo }: { tipo: string }) {
  const cls = TIPO_CLS[tipo] ?? 'bg-gray-100 text-gray-600'
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', cls)}>{tipo}</span>
}

const PAGE_SIZE = 50

export function ResultsPage() {
  const { result, sessionId, reset } = useConfront()
  const { setPage } = usePage()

  const [activeTab, setActiveTab]       = useState<TabId>('auditoria')
  const [emailOpen, setEmailOpen]       = useState(false)
  const [emailTo, setEmailTo]           = useState('')
  const [emailMsg, setEmailMsg]         = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailError, setEmailError]     = useState<string | null>(null)
  const [dlExcel, setDlExcel]           = useState(false)
  const [dlPdf, setDlPdf]               = useState(false)
  const [xmlPage, setXmlPage]           = useState(0)
  const [spedPage, setSpedPage]         = useState(0)
  const [authPage, setAuthPage]         = useState(0)
  const [cancelPage, setCancelPage]     = useState(0)
  // Filtro global de CFOP — compartilhado entre Dashboard e CFOP Agrupado
  const [cfopFilter, setCfopFilter]     = useState('')

  const cfopFilterSet = new Set(
    cfopFilter.split(/[\s,;]+/).map(s => s.trim()).filter(s => /^\d{4}$/.test(s)),
  )
  const isCfopFiltered = cfopFilterSet.size > 0

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-backgroundMuted">
        <div className="text-center">
          <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum confronto realizado ainda.</p>
          <Button className="mt-4 cursor-pointer" onClick={() => setPage('upload')}>Ir para Upload</Button>
        </div>
      </div>
    )
  }

  const divergencias   = result.xmlsNotInSped.length + result.spedNotInXml.length
  const xmlItems: XmlItem[]   = result.xmlsNotInSped
  const spedItems: SpedItem[] = result.spedNotInXml
  const authItems: XmlItem[]  = result.xmlsSemAutorizacao ?? []
  const cancelItems: CancelamentoItem[] = result.cancelamentos ?? []
  const xmlSlice    = xmlItems.slice(xmlPage * PAGE_SIZE, (xmlPage + 1) * PAGE_SIZE)
  const spedSlice   = spedItems.slice(spedPage * PAGE_SIZE, (spedPage + 1) * PAGE_SIZE)
  const authSlice   = authItems.slice(authPage * PAGE_SIZE, (authPage + 1) * PAGE_SIZE)
  const cancelSlice = cancelItems.slice(cancelPage * PAGE_SIZE, (cancelPage + 1) * PAGE_SIZE)

  async function handleDownload(type: 'excel' | 'pdf') {
    if (!sessionId || !result) return
    type === 'excel' ? setDlExcel(true) : setDlPdf(true)
    try {
      const blob = type === 'excel' ? await downloadExcel(sessionId) : await downloadPdf(sessionId)
      const ext  = type === 'excel' ? 'xlsx' : 'pdf'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = buildFilename(result.spedInfo.nome, result.spedInfo.dtIni, ext)
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      type === 'excel' ? setDlExcel(false) : setDlPdf(false)
    }
  }

  async function handleSendEmail() {
    if (!sessionId || !emailTo) return
    setEmailLoading(true); setEmailError(null)
    try {
      await sendEmailReport(sessionId, emailTo, emailMsg || undefined)
      setEmailSuccess(true)
      setTimeout(() => { setEmailOpen(false); setEmailSuccess(false) }, 2200)
    } catch (err) {
      setEmailError((err as Error).message)
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Summary cards ──────────────────────────────────────────────────────────
  const semAuth    = result.totalSemAutorizacao ?? authItems.length
  const totalCanc  = result.totalCancelamentos ?? cancelItems.length
  const summaryCards = [
    { label: 'Entradas SPED',         value: result.totalSpedEntries, icon: FileText,      color: 'text-primary',     bg: 'bg-primary/8' },
    { label: 'XMLs enviados',         value: result.totalXmls,        icon: FolderOpen,    color: 'text-secondary',   bg: 'bg-secondary/8' },
    { label: 'Conferidos (OK)',       value: result.totalMatches,     icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Divergências',          value: divergencias,            icon: AlertTriangle, color: divergencias > 0 ? 'text-red-500' : 'text-emerald-600', bg: divergencias > 0 ? 'bg-red-50' : 'bg-emerald-50' },
    { label: 'Sem autorização SEFAZ', value: semAuth,                 icon: ShieldAlert,   color: semAuth > 0 ? 'text-orange-600' : 'text-emerald-600', bg: semAuth > 0 ? 'bg-orange-50' : 'bg-emerald-50' },
    { label: 'Cancelamentos',         value: totalCanc,               icon: X,             color: totalCanc > 0 ? 'text-purple-600' : 'text-muted-foreground', bg: totalCanc > 0 ? 'bg-purple-50' : 'bg-muted/20' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F5F7]">

      {/* ── Cabeçalho navy com orbs (padrão Seven) ───────────────────────── */}
      <header className="relative overflow-hidden bg-[#0d1f30]">
        <div className="pointer-events-none absolute inset-0">
          <div className="login-orb login-orb-1" style={{ opacity: 0.2 }} />
          <div className="login-orb login-orb-2" style={{ opacity: 0.15 }} />
        </div>

        <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          {/* Esquerda */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage('upload')}
              className="cursor-pointer flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Novo confronto
            </button>
            <span className="text-white/20 hidden sm:inline">|</span>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold tracking-widest uppercase text-white/40">AnaliseSped</p>
              <h1 className="text-base font-semibold text-white leading-tight">Resultado do Confronto</h1>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload('excel')}
              disabled={dlExcel}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
            >
              {dlExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Excel
            </button>
            <button
              type="button"
              onClick={() => handleDownload('pdf')}
              disabled={dlPdf}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50 transition-colors"
            >
              {dlPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              PDF
            </button>
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary/90 transition-colors"
            >
              <Mail className="h-3.5 w-3.5" />
              Enviar por e-mail
            </button>
          </div>
        </div>

        {/* Info da empresa */}
        <div className="relative z-10 border-t border-white/10 mx-auto max-w-screen-xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-white/50">
            <span><span className="text-white/70 font-medium">Empresa:</span> {result.spedInfo.nome}</span>
            <span><span className="text-white/70 font-medium">CNPJ:</span> {result.spedInfo.cnpj}</span>
            <span><span className="text-white/70 font-medium">UF:</span> {result.spedInfo.uf}</span>
            <span><span className="text-white/70 font-medium">Período:</span> {formatDate(result.spedInfo.dtIni)} → {formatDate(result.spedInfo.dtFin)}</span>
            <span className="hidden md:inline"><span className="text-white/70 font-medium">Arquivo:</span> {result.spedFilename}</span>
            {result.filtroEmissao && result.filtroEmissao !== 'todas' && (
              <span className="inline-flex items-center rounded-full bg-secondary/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                {result.filtroEmissao === 'proprias' ? 'Notas próprias' : 'Notas de terceiros'}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-6 sm:px-6 lg:px-8">

        {/* ── Cards resumo ──────────────────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground leading-tight">{label}</p>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </span>
              </div>
              <p className={cn('mt-3 text-2xl font-bold tabular-nums', color)}>{value.toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="mb-4 flex overflow-x-auto gap-1 rounded-xl border border-border bg-white p-1 shadow-sm w-fit max-w-full">
          {([
            { id: 'auditoria'       as TabId, label: 'Auditoria Fiscal' },
            { id: 'dashboard'       as TabId, label: 'Dashboard' },
            { id: 'cfop-agrupado'   as TabId, label: 'CFOP Agrupado' },
            { id: 'resumo'          as TabId, label: 'Resumo' },
            { id: 'xml-sem-sped'    as TabId, label: `XMLs não no SPED (${result.xmlsNotInSped.length})` },
            { id: 'sped-sem-xml'    as TabId, label: `SPED sem XML (${result.spedNotInXml.length})` },
            { id: 'sem-autorizacao' as TabId, label: `Sem autorização (${semAuth})`,                  alert: semAuth > 0 },
            { id: 'cancelamentos'   as TabId, label: `Cancelamentos (${totalCanc})`,                   alert: false },
            { id: 'erros-leitura'   as TabId, label: `Erros de leitura (${result.xmlErrors.length})`,  alert: result.xmlErrors.length > 0 },
          ]).map(({ id, label, alert }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                activeTab === id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-backgroundMuted',
              )}
            >
              {alert && activeTab !== id && (
                <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />
              )}
              {label}
            </button>
          ))}
        </div>

        {/* ── Barra de filtro de CFOP (Dashboard + CFOP Agrupado) ──────── */}
        {(activeTab === 'auditoria' || activeTab === 'dashboard' || activeTab === 'cfop-agrupado') && (
          <div className={cn(
            'mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-sm transition-colors',
            isCfopFiltered
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-white',
          )}>
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar todos os totais por CFOP — ex: 5102, 5405  (separados por vírgula ou espaço)"
              value={cfopFilter}
              onChange={e => setCfopFilter(e.target.value)}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />
            {isCfopFiltered && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="hidden sm:flex gap-1">
                  {[...cfopFilterSet].map(c => (
                    <span key={c} className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{c}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCfopFilter('')}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Aba Auditoria Fiscal ──────────────────────────────────────── */}
        {activeTab === 'auditoria' && (
          <AuditoriaTab result={result} cfopFilterSet={cfopFilterSet} />
        )}

        {/* ── Aba Dashboard ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <DashboardTab result={result} cfopFilterSet={cfopFilterSet} />
        )}

        {/* ── Aba CFOP Agrupado ─────────────────────────────────────────── */}
        {activeTab === 'cfop-agrupado' && (
          <CfopAgrupadoTab result={result} cfopFilterSet={cfopFilterSet} />
        )}

        {/* ── Aba Resumo ────────────────────────────────────────────────── */}
        {activeTab === 'resumo' && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Resultado do confronto</h3>
            {divergencias === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
                <p className="text-base font-semibold text-emerald-700">Nenhuma divergência encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todos os {result.totalMatches.toLocaleString('pt-BR')} documentos foram conferidos com sucesso.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.xmlsNotInSped.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">
                        {result.xmlsNotInSped.length} XML{result.xmlsNotInSped.length !== 1 ? 's' : ''} não escriturado{result.xmlsNotInSped.length !== 1 ? 's' : ''} no SPED
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">Documentos presentes na pasta de XMLs que não constam no arquivo SPED.</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('xml-sem-sped')}
                      className="cursor-pointer shrink-0 text-xs font-medium text-red-600 hover:underline">
                      Ver lista →
                    </button>
                  </div>
                )}
                {result.spedNotInXml.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-700">
                        {result.spedNotInXml.length} entrada{result.spedNotInXml.length !== 1 ? 's' : ''} no SPED sem XML correspondente
                      </p>
                      <p className="mt-0.5 text-xs text-amber-600">Chaves escrituradas no SPED sem arquivo XML na pasta selecionada.</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('sped-sem-xml')}
                      className="cursor-pointer shrink-0 text-xs font-medium text-amber-600 hover:underline">
                      Ver lista →
                    </button>
                  </div>
                )}
                {semAuth > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <ShieldAlert className="h-5 w-5 shrink-0 text-orange-500" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-orange-700">
                        {semAuth} XML{semAuth !== 1 ? 's' : ''} sem autorização SEFAZ
                      </p>
                      <p className="mt-0.5 text-xs text-orange-600">Documentos sem protocolo de autorização ou com status diferente de 100/150.</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('sem-autorizacao')}
                      className="cursor-pointer shrink-0 text-xs font-medium text-orange-600 hover:underline">
                      Ver lista →
                    </button>
                  </div>
                )}
                {result.xmlErrors.length > 0 && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-700">
                        {result.xmlErrors.length} arquivo{result.xmlErrors.length !== 1 ? 's' : ''} XML ignorado{result.xmlErrors.length !== 1 ? 's' : ''} por erro de leitura
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">Arquivos que não puderam ser lidos ou não são XMLs válidos de NF-e/CT-e.</p>
                    </div>
                    <button type="button" onClick={() => setActiveTab('erros-leitura')}
                      className="cursor-pointer shrink-0 text-xs font-medium text-gray-600 hover:underline">
                      Ver lista →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Aba XMLs não no SPED ──────────────────────────────────────── */}
        {activeTab === 'xml-sem-sped' && (
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {xmlItems.length === 0 ? (
              <EmptyState label="Todos os XMLs estão escriturados no SPED." />
            ) : (
              <>
                <TableScrollWrapper>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-white">
                        <Th>Chave de Acesso (44)</Th>
                        <Th>Arquivo XML</Th>
                        <Th>Tipo</Th>
                        <Th>Oper.</Th>
                        <Th>Nº NF</Th>
                        <Th>Série</Th>
                        <Th>Emissão</Th>
                        <Th>CNPJ Emitente</Th>
                        <Th>Emitente</Th>
                        <Th>CFOP(s)</Th>
                        <Th right>VL NF (R$)</Th>
                        <Th right>BC ICMS</Th>
                        <Th right>VL ICMS</Th>
                        <Th right>BC ST</Th>
                        <Th right>VL ICMS ST</Th>
                        <Th right>VL IPI</Th>
                        <Th right>VL PIS</Th>
                        <Th right>VL COFINS</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {xmlSlice.map((item, i) => (
                        <tr key={item.chave} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                          <td className="px-3 py-2.5 align-top">
                            <span className="font-mono text-[10px] leading-relaxed text-foreground break-all">{item.chave}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="block max-w-[200px] truncate text-muted-foreground" title={item.filename}>{item.filename}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top"><TipoBadge tipo={item.tipo} /></td>
                          <td className="px-3 py-2.5 align-top"><TpNFBadge tpNF={item.tpNF} /></td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{item.nNF ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top">{item.serie ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(item.dhEmi)}</td>
                          <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">{item.cnpjEmit ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="block max-w-[160px] truncate" title={item.xNomeEmit}>{item.xNomeEmit ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap font-mono text-[10px] text-muted-foreground">{item.cfops ?? '—'}</td>
                          {[item.vNF, item.vBC, item.vICMS, item.vBCST, item.vST, item.vIPI, item.vPIS, item.vCOFINS].map((v, idx) => (
                            <td key={idx} className="px-3 py-2.5 align-top text-right whitespace-nowrap tabular-nums">
                              {v && Number(v) > 0 ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
                <Pagination total={xmlItems.length} page={xmlPage} pageSize={PAGE_SIZE} onChange={setXmlPage} />
              </>
            )}
          </div>
        )}

        {/* ── Aba SPED sem XML ──────────────────────────────────────────── */}
        {activeTab === 'sped-sem-xml' && (
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {spedItems.length === 0 ? (
              <EmptyState label="Todos os registros SPED têm XML correspondente." />
            ) : (
              <>
                <TableScrollWrapper>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-white">
                        <Th>Chave de Acesso (44)</Th>
                        <Th>Registro</Th>
                        <Th>Modelo</Th>
                        <Th>Série</Th>
                        <Th>Nº Doc</Th>
                        <Th>Data Doc</Th>
                        <Th>Situação</Th>
                        <Th>Operação</Th>
                        <Th right>VL DOC (R$)</Th>
                        <Th right>BC ICMS</Th>
                        <Th right>VL ICMS</Th>
                        <Th right>BC ST</Th>
                        <Th right>VL ICMS ST</Th>
                        <Th right>VL IPI</Th>
                        <Th right>VL PIS</Th>
                        <Th right>VL COFINS</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {spedSlice.map((item, i) => (
                        <tr key={item.chave} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                          <td className="px-3 py-2.5 align-top">
                            <span className="font-mono text-[10px] leading-relaxed text-foreground break-all">{item.chave}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">{item.registro}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{MODELO_MAP[item.codMod ?? ''] ?? item.codMod ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top">{item.ser ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">{item.numDoc ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(item.dtDoc)}</td>
                          <td className="px-3 py-2.5 align-top"><SituacaoBadge codSit={item.codSit} /></td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">
                            <span className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              item.indOper === '0'
                                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                                : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
                            )}>
                              {item.indOper === '0' ? 'Entrada' : 'Saída'}
                            </span>
                          </td>
                          {[item.vlDoc, item.vlBcIcms, item.vlIcms, item.vlBcIcmsSt, item.vlIcmsSt, item.vlIpi, item.vlPis, item.vlCofins].map((v, idx) => (
                            <td key={idx} className="px-3 py-2.5 align-top text-right whitespace-nowrap tabular-nums">
                              {v != null && v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
                <Pagination total={spedItems.length} page={spedPage} pageSize={PAGE_SIZE} onChange={setSpedPage} />
              </>
            )}
          </div>
        )}

        {/* ── Aba Sem Autorização ───────────────────────────────────────── */}
        {activeTab === 'sem-autorizacao' && (
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {authItems.length === 0 ? (
              <EmptyState label="Todos os XMLs possuem autorização SEFAZ." />
            ) : (
              <>
                <TableScrollWrapper>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-white">
                        <Th>Chave de Acesso (44)</Th>
                        <Th>Arquivo XML</Th>
                        <Th>Tipo</Th>
                        <Th>cStat</Th>
                        <Th>Motivo SEFAZ</Th>
                        <Th>Nº NF</Th>
                        <Th>Emissão</Th>
                        <Th>CNPJ Emitente</Th>
                        <Th>Emitente</Th>
                        <Th>Dt Recebto</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {authSlice.map((item, i) => (
                        <tr key={item.chave + item.filename} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                          <td className="px-3 py-2.5 align-top">
                            <span className="font-mono text-[10px] leading-relaxed text-foreground break-all">{item.chave}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="block max-w-[180px] truncate text-muted-foreground" title={item.filename}>{item.filename}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top"><TipoBadge tipo={item.tipo} /></td>
                          <td className="px-3 py-2.5 align-top">
                            <AuthBadge cStat={item.cStat} />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="block max-w-[220px] truncate text-muted-foreground" title={item.xMotivo}>
                              {item.xMotivo ?? 'Sem protocolo de autorização'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{item.nNF ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(item.dhEmi)}</td>
                          <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap">{item.cnpjEmit ?? '—'}</td>
                          <td className="px-3 py-2.5 align-top">
                            <span className="block max-w-[140px] truncate" title={item.xNomeEmit}>{item.xNomeEmit ?? '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(item.dhRecbto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
                <Pagination total={authItems.length} page={authPage} pageSize={PAGE_SIZE} onChange={setAuthPage} />
              </>
            )}
          </div>
        )}

        {/* ── Aba Cancelamentos ─────────────────────────────────────────── */}
        {activeTab === 'cancelamentos' && (
          <CancelamentosTab
            items={cancelItems}
            slice={cancelSlice}
            page={cancelPage}
            onPageChange={setCancelPage}
          />
        )}

        {/* ── Aba Erros de Leitura ──────────────────────────────────────── */}
        {activeTab === 'erros-leitura' && (
          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            {result.xmlErrors.length === 0 ? (
              <EmptyState label="Nenhum arquivo XML com erro de leitura." />
            ) : (
              <>
                <div className="border-b border-border bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-700">
                    Estes arquivos foram encontrados na pasta mas não puderam ser interpretados como NF-e ou CT-e válidos.
                    Verifique se são XMLs com autorização SEFAZ ou se houve problema de encoding/corrupção.
                  </p>
                </div>
                <TableScrollWrapper>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-primary text-white">
                        <Th>Arquivo</Th>
                        <Th>Motivo do erro</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.xmlErrors.map((err, i) => (
                        <tr key={err.filename + i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                          <td className="px-3 py-2.5 align-top">
                            <span className="font-mono text-[11px] text-foreground">{err.filename}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted-foreground">
                            {err.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableScrollWrapper>
                <div className="border-t border-border bg-[#F8FAFC] px-4 py-2.5">
                  <p className="text-xs text-muted-foreground">{result.xmlErrors.length} arquivo{result.xmlErrors.length !== 1 ? 's' : ''} com erro</p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => { reset(); setPage('upload') }}
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline">
            Limpar e fazer novo confronto
          </button>
        </div>
      </main>

      {/* ── Modal E-mail ──────────────────────────────────────────────────── */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Enviar por e-mail</h2>
                <p className="text-xs text-muted-foreground mt-0.5">O relatório Excel e PDF serão enviados em anexo.</p>
              </div>
              <button type="button" onClick={() => setEmailOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-backgroundMuted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Destinatário *</label>
                <input
                  type="email"
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors"
                  placeholder="email@empresa.com.br"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-foreground">Mensagem <span className="font-normal text-muted-foreground">(opcional)</span></label>
                <textarea
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-colors resize-none"
                  rows={3}
                  placeholder="Segue em anexo o relatório de confronto SPED × XML..."
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                />
              </div>
              {emailError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                  <p className="text-xs text-red-700">{emailError}</p>
                </div>
              )}
              {emailSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-xs font-medium text-emerald-700">E-mail enviado com sucesso!</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEmailOpen(false)} className="cursor-pointer">Cancelar</Button>
              <Button size="sm" disabled={!emailTo || emailLoading} onClick={handleSendEmail}
                className="cursor-pointer gap-1.5 bg-primary hover:bg-primary/90">
                {emailLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componentes auxiliares ─────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={cn(
      'whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold tracking-wide',
      right && 'text-right',
    )}>
      {children}
    </th>
  )
}

function TableScrollWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {children}
        </div>
      </div>
      {/* Sombra fade à direita como indicador de scroll */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white/60 to-transparent sm:hidden" />
    </div>
  )
}

// ── Auditoria Fiscal Tab ──────────────────────────────────────────────────────

const VERDICT_CFG = {
  ok:          { label: 'APROVADO',    bg: 'bg-emerald-50', border: 'border-emerald-300', dot: 'bg-emerald-500', text: 'text-emerald-800', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  atencao:     { label: 'ATENÇÃO',     bg: 'bg-amber-50',   border: 'border-amber-300',   dot: 'bg-amber-500',   text: 'text-amber-800',   badge: 'bg-amber-100 text-amber-800 ring-amber-200'   },
  divergencia: { label: 'DIVERGÊNCIA', bg: 'bg-red-50',     border: 'border-red-300',     dot: 'bg-red-500',     text: 'text-red-800',     badge: 'bg-red-100 text-red-800 ring-red-200'         },
}

function AuditoriaTab({
  result,
  cfopFilterSet,
}: {
  result: NonNullable<ReturnType<typeof useConfront>['result']>
  cfopFilterSet: Set<string>
}) {
  const isFiltered = cfopFilterSet.size > 0

  // Defaults garantem compatibilidade com sessões antigas que não têm os novos campos
  const auditDefaults = {
    totalSpedCount: result.totalSpedEntries,
    totalXmlCount: result.totalXmls,
    matchedCount: result.totalMatches,
    totalSpedValue: result.dashboard?.totalVlSpedGeral ?? 0,
    totalXmlValue: result.dashboard?.totalVlXmlGeral ?? 0,
    totalValueDiff: 0,
    totalVlSpedMatched: 0,
    totalVlXmlMatched: 0,
    totalVlXmlNotInSped: 0,
    totalVlSpedNotInXml: 0,
    matchedWithValueDiff: [] as AuditItem[],
    verdict: 'ok' as 'ok' | 'atencao' | 'divergencia',
    verdictMessages: [] as string[],
  }
  const audit = { ...auditDefaults, ...(result.audit ?? {}) }

  const cfg = VERDICT_CFG[audit.verdict as keyof typeof VERDICT_CFG] ?? VERDICT_CFG.ok
  const diffRows = [...(audit.matchedWithValueDiff ?? [])].sort((a, b) => b.diferenca - a.diferenca)

  const matchedDiff = audit.totalVlSpedMatched - audit.totalVlXmlMatched

  // C190: filtrado por CFOP quando ativo
  const allCfopSummary = result.dashboard?.cfopSummary ?? []
  const filteredCfopSummary = isFiltered
    ? allCfopSummary.filter(r => cfopFilterSet.has(r.cfop))
    : allCfopSummary
  const totalC190Opr = filteredCfopSummary.reduce((s, r) => s + r.vlOpr, 0)
  const totalC190Icms  = filteredCfopSummary.reduce((s, r) => s + r.vlIcms, 0)
  const totalC190IcmsSt = filteredCfopSummary.reduce((s, r) => s + r.vlIcmsSt, 0)

  // XMLs não escriturados filtrados por CFOP
  const xmlNotInSpedAll = result.xmlsNotInSped ?? []
  const xmlNotInSpedFiltered = isFiltered
    ? xmlNotInSpedAll.filter(xml => {
        if (!xml.cfops) return false
        const xmlCfops = xml.cfops.split(/[\s,]+/).map(c => c.trim())
        return xmlCfops.some(c => cfopFilterSet.has(c))
      })
    : xmlNotInSpedAll
  const filteredXmlNotInSpedVnf = xmlNotInSpedFiltered.reduce((s, r) => s + (Number(r.vNF) || 0), 0)

  const checks: Array<{ label: string; ok: boolean; detail: string }> = [
    {
      label: 'Quantidade de documentos',
      ok: audit.totalSpedCount === audit.totalXmlCount,
      detail: `SPED: ${audit.totalSpedCount} | XML: ${audit.totalXmlCount}`,
    },
    {
      label: 'Documentos conferidos (chave)',
      ok: audit.matchedCount === audit.totalSpedCount && audit.matchedCount === audit.totalXmlCount,
      detail: `${audit.matchedCount} de ${Math.max(audit.totalSpedCount, audit.totalXmlCount)} pares encontrados`,
    },
    {
      label: 'Valores nos pares conferidos',
      ok: Math.abs(matchedDiff) <= 0.01 && diffRows.length === 0,
      detail: Math.abs(matchedDiff) <= 0.01
        ? `R$ ${BRL(audit.totalVlSpedMatched)} — valores idênticos nos pares`
        : `SPED R$ ${BRL(audit.totalVlSpedMatched)} | XML R$ ${BRL(audit.totalVlXmlMatched)} | Δ R$ ${BRL(Math.abs(matchedDiff))}`,
    },
    {
      label: 'Valores por documento',
      ok: diffRows.length === 0,
      detail: diffRows.length === 0
        ? 'Nenhuma divergência de valor nos pares conferidos'
        : `${diffRows.length} documento(s) com valor diferente entre SPED e XML`,
    },
  ]

  // Diferenças (usam totais gerais — C100 não tem detalhe por CFOP)
  const diffXmlVsSped   = audit.totalXmlValue - audit.totalSpedValue
  const diffC100VsC190All = Math.abs(audit.totalSpedValue - (result.dashboard?.cfopSummary ?? []).reduce((s, r) => s + r.vlOpr, 0))
  const diffC100VsC190  = isFiltered ? Math.abs(audit.totalSpedValue - totalC190Opr) : diffC100VsC190All

  return (
    <div className="flex flex-col gap-4">

      {/* ── Mapa das Diferenças ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-[#0d1f30]">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-white">Mapa das Diferenças</p>
              <p className="mt-0.5 text-xs text-white/60">De onde vem cada número e o que o contador precisa investigar</p>
            </div>
            {isFiltered && (
              <span className="rounded-full bg-primary/40 border border-primary/60 px-2.5 py-0.5 text-[10px] font-bold text-white ml-auto">
                Filtrado: {[...cfopFilterSet].join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Três fontes de valor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* XML */}
          <div className={cn('px-6 py-5 flex flex-col gap-1', isFiltered && 'opacity-60')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400 shrink-0" />
              <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wide">XMLs enviados</p>
              {isFiltered && <span className="ml-auto text-[9px] text-muted-foreground rounded-full bg-muted px-1.5">total geral</span>}
            </div>
            <p className="text-xs text-muted-foreground">Campo <code className="bg-muted px-1 rounded">vNF</code> de cada arquivo XML</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">R$ {BRL(audit.totalXmlValue)}</p>
            <p className="text-[11px] text-muted-foreground">
              {isFiltered ? 'Sem detalhe por CFOP para documentos conferidos' : 'Valor nominal das notas fiscais eletrônicas'}
            </p>
          </div>

          {/* SPED C100 */}
          <div className={cn('px-6 py-5 flex flex-col gap-1', isFiltered && 'opacity-60')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              <p className="text-[11px] font-bold text-primary uppercase tracking-wide">SPED — Registro C100</p>
              {isFiltered && <span className="ml-auto text-[9px] text-muted-foreground rounded-full bg-muted px-1.5">total geral</span>}
            </div>
            <p className="text-xs text-muted-foreground">Campo <code className="bg-muted px-1 rounded">VL_DOC</code> de cada documento</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">R$ {BRL(audit.totalSpedValue)}</p>
            <p className="text-[11px] text-muted-foreground">
              {isFiltered ? 'C100 não tem detalhe por CFOP' : 'Valor total de cada nota escriturada individualmente'}
            </p>
          </div>

          {/* SPED C190 */}
          <div className="px-6 py-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 shrink-0" />
              <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wide">SPED — Registro C190</p>
              {isFiltered && (
                <span className="ml-auto text-[9px] font-semibold text-indigo-700 rounded-full bg-indigo-50 border border-indigo-200 px-1.5">filtrado</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Campo <code className="bg-muted px-1 rounded">VL_OPR</code> por CFOP/CST</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-foreground">R$ {BRL(totalC190Opr)}</p>
            {isFiltered ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-[11px] text-indigo-700">
                  {filteredCfopSummary.length} linha{filteredCfopSummary.length !== 1 ? 's' : ''} C190 — CFOPs: {[...cfopFilterSet].join(', ')}
                </p>
                <p className="text-[10px] text-muted-foreground">VL ICMS: R$ {BRL(totalC190Icms)} · ST: R$ {BRL(totalC190IcmsSt)}</p>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Valor das operações — base para apuração do ICMS</p>
            )}
          </div>
        </div>

        {/* Explicação das diferenças */}
        <div className="border-t border-border divide-y divide-border">

          {/* Diferença 1: XML vs SPED C100 */}
          <div className={cn('px-6 py-4', Math.abs(diffXmlVsSped) > 0.01 ? 'bg-red-50' : 'bg-emerald-50')}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-500 font-bold text-sm">XML</span>
                <span className="text-muted-foreground text-sm">→</span>
                <span className="text-primary font-bold text-sm">SPED C100</span>
              </div>
              <span className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 whitespace-nowrap shrink-0',
                Math.abs(diffXmlVsSped) > 0.01
                  ? 'bg-red-100 text-red-700 ring-red-200'
                  : 'bg-emerald-100 text-emerald-700 ring-emerald-200',
              )}>
                {Math.abs(diffXmlVsSped) > 0.01 ? '⚠ INVESTIGAR' : '✓ OK'}
              </span>
            </div>
            <p className={cn('text-sm font-semibold mb-1', Math.abs(diffXmlVsSped) > 0.01 ? 'text-red-800' : 'text-emerald-800')}>
              {Math.abs(diffXmlVsSped) > 0.01
                ? `Diferença de R$ ${BRL(Math.abs(diffXmlVsSped))} — divergência de escrituração`
                : 'Sem diferença — XML e SPED C100 conferem'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Essa diferença exige ação: pode haver XMLs não escriturados no SPED, notas com VL_DOC zerado
              ou documentos no SPED sem XML correspondente. Veja as abas <strong>XMLs não no SPED</strong>,{' '}
              <strong>SPED sem XML</strong> e <strong>Documentos com valor divergente</strong>.
            </p>
          </div>

          {/* Diferença 2: C100 vs C190 — normal */}
          <div className="px-6 py-4 bg-blue-50/40">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold text-sm">SPED C100</span>
                <span className="text-muted-foreground text-sm">→</span>
                <span className="text-indigo-700 font-bold text-sm">SPED C190</span>
              </div>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 whitespace-nowrap shrink-0 bg-blue-100 text-blue-700 ring-blue-200">
                ℹ NORMAL
              </span>
            </div>
            <p className="text-sm font-semibold text-blue-900 mb-1">
              {diffC100VsC190 > 0.01
                ? `Diferença de R$ ${BRL(diffC100VsC190)} — esperada por design do SPED`
                : 'Sem diferença entre C100 e C190'}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              O <strong>VL_DOC</strong> (C100) é o valor total da nota incluindo frete, seguro e despesas acessórias.
              O <strong>VL_OPR</strong> (C190) exclui esses itens pois representa apenas o valor da operação
              para fins de apuração do ICMS. Diferença prevista na legislação — não requer correção.
            </p>
          </div>
        </div>
      </div>

      {/* ── Comparativo filtrado por CFOP (apenas quando filtro ativo) ── */}
      {isFiltered && (() => {
        const diff = filteredXmlNotInSpedVnf - totalC190Opr
        const pct  = totalC190Opr > 0 ? Math.abs(diff / totalC190Opr * 100) : 0
        const hasDiff = Math.abs(diff) > 0.01
        return (
          <div className={cn(
            'rounded-xl border-2 p-5',
            hasDiff ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50',
          )}>
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className={cn('h-3 w-3 rounded-full shrink-0', hasDiff ? 'bg-amber-500' : 'bg-emerald-500')} />
              <p className={cn('text-sm font-bold tracking-wide', hasDiff ? 'text-amber-800' : 'text-emerald-800')}>
                Comparativo — CFOP{cfopFilterSet.size !== 1 ? 's' : ''}: {[...cfopFilterSet].join(', ')}
              </p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {filteredCfopSummary.length} linha{filteredCfopSummary.length !== 1 ? 's' : ''} C190
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-3">
              <div className="rounded-lg border border-primary/20 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">SPED — VL Operação C190</p>
                <p className="text-lg font-bold tabular-nums text-primary">R$ {BRL(totalC190Opr)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">VL ICMS: R$ {BRL(totalC190Icms)} · ST: R$ {BRL(totalC190IcmsSt)}</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">XML — VL NF (não escriturados)</p>
                <p className="text-lg font-bold tabular-nums text-amber-700">R$ {BRL(filteredXmlNotInSpedVnf)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{xmlNotInSpedFiltered.length} doc{xmlNotInSpedFiltered.length !== 1 ? 's' : ''} sem escrituração</p>
              </div>
              <div className={cn('rounded-lg border px-4 py-3', hasDiff ? 'border-amber-300 bg-amber-100' : 'border-emerald-200 bg-emerald-50')}>
                <p className={cn('text-[10px] font-semibold uppercase tracking-wide mb-0.5', hasDiff ? 'text-amber-800' : 'text-emerald-700')}>Diferença</p>
                <p className={cn('text-lg font-bold tabular-nums', hasDiff ? 'text-amber-800' : 'text-emerald-700')}>
                  {hasDiff ? `R$ ${BRL(Math.abs(diff))}` : '—'}
                </p>
                {hasDiff && <p className="text-[10px] text-amber-700 mt-0.5">{pct.toFixed(2)}% sobre o C190</p>}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              * SPED C190 inclui todos os documentos escriturados com esses CFOPs. XML refere-se apenas aos documentos <strong>não escriturados no SPED</strong> — documentos conferidos não são detalhados por CFOP individualmente.
            </p>
          </div>
        )
      })()}

      {/* Veredicto */}
      <div className={cn('rounded-xl border-2 p-5 flex items-start gap-4', cfg.bg, cfg.border)}>
        <span className={cn('mt-0.5 h-4 w-4 rounded-full shrink-0', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className={cn('text-base font-bold tracking-wide', cfg.text)}>{cfg.label}</p>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', cfg.badge)}>
              Auditoria Fiscal SPED × XML
            </span>
            {isFiltered && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                total geral
              </span>
            )}
          </div>
          <ul className="mt-2 space-y-1">
            {audit.verdictMessages.map((msg, i) => (
              <li key={i} className={cn('text-sm', cfg.text)}>{msg}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Checklist de pontos auditados */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-foreground">Pontos verificados</p>
        </div>
        <ul className="divide-y divide-border">
          {checks.map(({ label, ok, detail }) => (
            <li key={label} className="flex items-center gap-4 px-6 py-3">
              <span className={cn(
                'shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
                ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
              )}>
                {ok ? '✓' : '✗'}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Decomposição dos totais */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-[#F8FAFC]">
          <p className="text-sm font-semibold text-foreground">Decomposição dos valores</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isFiltered
              ? `XMLs não escriturados filtrados por: ${[...cfopFilterSet].join(', ')} — pares conferidos e SPED sem XML exibem total geral (sem detalhe por CFOP)`
              : 'De onde vem a diferença entre o total SPED e o total XML'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0d1f30] text-white text-left">
                <th className="px-4 py-3 font-semibold">Origem</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Qtd docs</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">VL SPED</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">VL XML</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Diferença</th>
              </tr>
            </thead>
            <tbody>
              <tr className={cn('border-b border-border', isFiltered ? 'bg-white/60' : 'bg-white')}>
                <td className="px-4 py-3">
                  <p className={cn('font-medium', isFiltered ? 'text-muted-foreground' : 'text-foreground')}>Pares conferidos (chave OK)</p>
                  <p className="text-muted-foreground">Documentos presentes nos dois lados{isFiltered ? ' — total geral' : ''}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{audit.matchedCount}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">{BRL(audit.totalVlSpedMatched)}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">{BRL(audit.totalVlXmlMatched)}</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', Math.abs(matchedDiff) > 0.01 ? 'text-red-600' : 'text-emerald-600')}>
                  {Math.abs(matchedDiff) > 0.01 ? BRL(Math.abs(matchedDiff)) : '—'}
                </td>
              </tr>
              <tr className="bg-[#F2F5F7] border-b border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">
                    XMLs sem escrituração no SPED
                    {isFiltered && (
                      <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">filtrado</span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {isFiltered
                      ? `${xmlNotInSpedFiltered.length} de ${xmlNotInSpedAll.length} XMLs com CFOP ${[...cfopFilterSet].join(', ')}`
                      : 'XMLs enviados que não constam no SPED'}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{isFiltered ? xmlNotInSpedFiltered.length : result.xmlsNotInSped.length}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap', (isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) > 0 ? 'text-red-600 font-semibold' : '')}>
                  {(isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) > 0
                    ? BRL(isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) : '—'}
                </td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', (isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {(isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) > 0
                    ? BRL(isFiltered ? filteredXmlNotInSpedVnf : audit.totalVlXmlNotInSped) : '—'}
                </td>
              </tr>
              <tr className={cn('border-b border-border', isFiltered ? 'bg-white/60' : 'bg-white')}>
                <td className="px-4 py-3">
                  <p className={cn('font-medium', isFiltered ? 'text-muted-foreground' : 'text-foreground')}>SPED sem XML correspondente</p>
                  <p className="text-muted-foreground">Chaves no SPED sem arquivo XML enviado{isFiltered ? ' — total geral' : ''}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{result.spedNotInXml.length}</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap', audit.totalVlSpedNotInXml > 0 ? 'text-muted-foreground' : '')}>
                  {audit.totalVlSpedNotInXml > 0 ? BRL(audit.totalVlSpedNotInXml) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', !isFiltered && audit.totalVlSpedNotInXml > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {audit.totalVlSpedNotInXml > 0 ? BRL(audit.totalVlSpedNotInXml) : '—'}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold">
                <td className="px-4 py-2.5 text-xs font-bold text-primary">{isFiltered ? 'TOTAL GERAL' : 'TOTAL GERAL'}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums">{Math.max(audit.totalSpedCount, audit.totalXmlCount)}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap">{BRL(audit.totalSpedValue)}</td>
                <td className="px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap">{BRL(audit.totalXmlValue)}</td>
                <td className={cn('px-4 py-2.5 text-right text-xs tabular-nums whitespace-nowrap font-bold', audit.totalValueDiff > 0.01 ? 'text-red-600' : 'text-emerald-600')}>
                  {audit.totalValueDiff > 0.01 ? BRL(audit.totalValueDiff) : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tabela de divergências de valor nos pares conferidos */}
      {diffRows.length > 0 && (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-border bg-amber-50 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              Documentos conferidos com valor divergente ({diffRows.length})
            </p>
          </div>
          <TableScrollWrapper>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0d1f30] text-white text-left">
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">Chave (44)</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">Nº Doc</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">Data</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">Oper.</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap">Emitente</th>
                  <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">VL SPED</th>
                  <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">VL XML</th>
                  <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {diffRows.map((row, i) => (
                  <tr key={row.chave} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                    <td className="px-3 py-2.5 align-top">
                      <span className="font-mono text-[10px] text-foreground break-all leading-relaxed">{row.chave}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">{row.numDoc ?? '—'}</td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(row.dtDoc)}</td>
                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        row.indOper === '0' ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
                      )}>
                        {row.indOper === '0' ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <span className="block max-w-[160px] truncate" title={row.xNomeEmit}>{row.xNomeEmit ?? row.cnpjEmit ?? '—'}</span>
                    </td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap">{BRL(row.vlSped)}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap">{BRL(row.vlXml)}</td>
                    <td className="px-3 py-2.5 align-top text-right tabular-nums whitespace-nowrap font-semibold text-red-600">{BRL(row.diferenca)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-amber-50 border-t-2 border-amber-200 font-semibold">
                  <td colSpan={7} className="px-3 py-2 text-xs font-bold text-amber-800">TOTAL DIFERENÇA</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-red-600">
                    {BRL(diffRows.reduce((s, r) => s + r.diferenca, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </TableScrollWrapper>
        </div>
      )}

      {/* Estado vazio — tudo OK */}
      {diffRows.length === 0 && audit.verdict === 'ok' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 flex flex-col items-center text-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-800">Documentos conferidos sem divergências de valor</p>
          <p className="text-xs text-emerald-700">
            Todos os {audit.matchedCount} pares apresentam VL_DOC (SPED) idêntico ao vNF (XML).
          </p>
        </div>
      )}
    </div>
  )
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function BRL(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DashboardTab({
  result,
  cfopFilterSet,
}: {
  result: NonNullable<ReturnType<typeof useConfront>['result']>
  cfopFilterSet: Set<string>
}) {
  const db = result.dashboard ?? {
    totalVlSpedGeral: 0, totalVlSpedEntradas: 0, totalVlSpedSaidas: 0,
    totalVlOprC190: 0, totalVlOprC190Entradas: 0, totalVlOprC190Saidas: 0,
    totalVlXmlGeral: 0,  totalVlXmlEntradas: 0,  totalVlXmlSaidas: 0,
    cfopSummary: [],
  }

  const isDashFiltered = cfopFilterSet.size > 0

  const cfopRows: CfopSummary[] = [...db.cfopSummary].sort((a, b) =>
    a.cfop.localeCompare(b.cfop),
  )

  const cfopRowsFiltered = isDashFiltered
    ? cfopRows.filter(r => cfopFilterSet.has(r.cfop))
    : cfopRows

  // VL_OPR total: usa campo calculado pelo backend (sessões novas) ou soma local (sessões antigas)
  const totalVlOprC190All         = db.totalVlOprC190 ?? cfopRows.reduce((s, r) => s + r.vlOpr, 0)
  const totalVlOprC190Entradas    = db.totalVlOprC190Entradas ?? cfopRows.filter(r => ['1','2'].includes(r.cfop[0])).reduce((s, r) => s + r.vlOpr, 0)
  const totalVlOprC190Saidas      = db.totalVlOprC190Saidas   ?? cfopRows.filter(r => ['5','6'].includes(r.cfop[0])).reduce((s, r) => s + r.vlOpr, 0)

  // Quando filtrado: recalcula VL_OPR a partir das linhas C190 filtradas
  const vlOprGeral    = isDashFiltered ? cfopRowsFiltered.reduce((s, r) => s + r.vlOpr, 0) : totalVlOprC190All
  const vlOprEntradas = isDashFiltered ? cfopRowsFiltered.filter(r => ['1','2','3'].includes(r.cfop[0])).reduce((s, r) => s + r.vlOpr, 0) : totalVlOprC190Entradas
  const vlOprSaidas   = isDashFiltered ? cfopRowsFiltered.filter(r => ['5','6','7'].includes(r.cfop[0])).reduce((s, r) => s + r.vlOpr, 0) : totalVlOprC190Saidas
  const vlIcmsGeral   = cfopRowsFiltered.reduce((s, r) => s + r.vlIcms, 0)
  const vlIcmsStGeral = cfopRowsFiltered.reduce((s, r) => s + r.vlIcmsSt, 0)

  const totalCfopOpr  = vlOprGeral
  const totalCfopIcms = vlIcmsGeral
  const totalCfopSt   = vlIcmsStGeral

  // Totais XML filtrados por CFOP (apenas xmlsNotInSped — matched não tem detalhe por CFOP)
  const xmlFiltered = isDashFiltered
    ? (result.xmlsNotInSped ?? []).filter(xml => {
        if (!xml.cfops) return false
        const xmlCfops = xml.cfops.split(/[\s,]+/).map(c => c.trim())
        return xmlCfops.some(c => cfopFilterSet.has(c))
      })
    : result.xmlsNotInSped ?? []
  const filteredXmlVnf      = xmlFiltered.reduce((s, r) => s + (Number(r.vNF)   || 0), 0)
  const filteredXmlEntradas  = xmlFiltered.filter(r => r.tpNF === '0').reduce((s, r) => s + (Number(r.vNF) || 0), 0)
  const filteredXmlSaidas    = xmlFiltered.filter(r => r.tpNF === '1').reduce((s, r) => s + (Number(r.vNF) || 0), 0)
  const filteredXmlBcIcms    = xmlFiltered.reduce((s, r) => s + (Number(r.vBC)   || 0), 0)
  const filteredXmlIcms      = xmlFiltered.reduce((s, r) => s + (Number(r.vICMS) || 0), 0)
  const filteredXmlSt        = xmlFiltered.reduce((s, r) => s + (Number(r.vST)   || 0), 0)

  return (
    <div className="space-y-5">

      {/* ── Totais SPED ── */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">S</span>
          Valores apurados — SPED Fiscal
          {isDashFiltered && (
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
              Filtrado: {[...cfopFilterSet].join(', ')}
            </span>
          )}
        </h3>

        {/* VL_OPR C190 — referência fiscal principal */}
        <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">VL Operação — C190</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-white">Referência Fiscal</span>
            {isDashFiltered && (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-semibold text-primary">
                {cfopRowsFiltered.length} CFOP{cfopRowsFiltered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="mb-2 text-[10px] text-muted-foreground">
            {isDashFiltered
              ? `Total operacional dos CFOP${cfopFilterSet.size !== 1 ? 's' : ''} selecionado${cfopFilterSet.size !== 1 ? 's' : ''} (C190 VL_OPR)`
              : 'Total operacional escriturado (exclui frete, seguro e despesas acessórias — base usada pela contabilidade)'}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label: isDashFiltered ? 'VL_OPR filtrado'   : 'Total geral (VL_OPR)', value: vlOprGeral,    cls: 'text-primary' },
              { label: 'Entradas (1xxx/2xxx)',                                          value: vlOprEntradas, cls: 'text-blue-600' },
              { label: 'Saídas (5xxx/6xxx)',                                            value: vlOprSaidas,   cls: 'text-orange-600' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-md bg-white px-3 py-2 border border-primary/10">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className={cn('mt-0.5 text-base font-bold tabular-nums', cls)}>R$ {BRL(value)}</p>
              </div>
            ))}
          </div>
          {isDashFiltered && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-white px-3 py-2 border border-primary/10">
                <p className="text-[10px] text-muted-foreground">VL ICMS (filtrado)</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">R$ {BRL(vlIcmsGeral)}</p>
              </div>
              <div className="rounded-md bg-white px-3 py-2 border border-primary/10">
                <p className="text-[10px] text-muted-foreground">VL ICMS ST (filtrado)</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">R$ {BRL(vlIcmsStGeral)}</p>
              </div>
            </div>
          )}
        </div>

        {/* VL_DOC C100 — total dos documentos */}
        <div className={cn('rounded-lg border px-4 py-3', isDashFiltered ? 'border-border/50 bg-[#F8FAFC] opacity-60' : 'border-border bg-[#F8FAFC]')}>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">VL Documento — C100/D100 (inclui frete/seguro/acessórias)</p>
            {isDashFiltered && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">total geral</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label: 'Total geral (VL_DOC)',  value: db.totalVlSpedGeral,    cls: 'text-foreground' },
              { label: 'Entradas (IND_OPER=0)', value: db.totalVlSpedEntradas, cls: 'text-blue-600' },
              { label: 'Saídas (IND_OPER=1)',   value: db.totalVlSpedSaidas,   cls: 'text-orange-600' },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <p className={cn('mt-0.5 text-sm font-semibold tabular-nums', cls)}>R$ {BRL(value)}</p>
              </div>
            ))}
          </div>
          {isDashFiltered && (
            <p className="mt-2 text-[10px] text-muted-foreground/70">C100/D100 não possui detalhe por CFOP — exibindo total geral.</p>
          )}
        </div>
      </div>

      {/* ── Totais XML ── */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/10 text-[10px] font-bold text-secondary">X</span>
          Valores apurados — XMLs enviados
          {isDashFiltered && (
            <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
              Filtrado: {[...cfopFilterSet].join(', ')}
            </span>
          )}
        </h3>

        {isDashFiltered ? (
          /* Bloco filtrado — mesmo estilo do C190 */
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">VL NF — XMLs não escriturados</span>
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-bold text-white">
                {xmlFiltered.length} doc{xmlFiltered.length !== 1 ? 's' : ''}
              </span>
              <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                {[...cfopFilterSet].join(', ')}
              </span>
            </div>
            <p className="mb-2 text-[10px] text-amber-700/80">
              Documentos com esses CFOPs presentes na pasta XML mas não escriturados no SPED
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: 'VL NF total (vNF)',    value: filteredXmlVnf,     cls: 'text-amber-700' },
                { label: 'Entradas (tpNF=0)',    value: filteredXmlEntradas, cls: 'text-blue-600'  },
                { label: 'Saídas (tpNF=1)',      value: filteredXmlSaidas,   cls: 'text-orange-600'},
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-md bg-white px-3 py-2 border border-amber-200">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className={cn('mt-0.5 text-base font-bold tabular-nums', cls)}>R$ {BRL(value)}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: 'BC ICMS',    value: filteredXmlBcIcms },
                { label: 'VL ICMS',    value: filteredXmlIcms   },
                { label: 'VL ICMS ST', value: filteredXmlSt     },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-md bg-white px-3 py-2 border border-amber-200">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">R$ {BRL(value)}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-amber-700/70">
              * Documentos conferidos (presentes em ambos os lados) não são detalhados por CFOP individualmente.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Total geral (vNF)',    value: db.totalVlXmlGeral,    cls: 'text-secondary' },
              { label: 'Entradas (tpNF=0)',    value: db.totalVlXmlEntradas, cls: 'text-blue-600' },
              { label: 'Saídas (tpNF=1)',      value: db.totalVlXmlSaidas,   cls: 'text-orange-600' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="rounded-lg border border-border bg-[#F8FAFC] px-4 py-3">
                <p className="text-[11px] text-muted-foreground">{label}</p>
                <p className={cn('mt-1 text-lg font-bold tabular-nums', cls)}>R$ {BRL(value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Resumo por CFOP ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Resumo por CFOP — Registro C190</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isDashFiltered
              ? `Exibindo ${cfopRowsFiltered.length} de ${cfopRows.length} CFOPs — filtrado por: ${[...cfopFilterSet].join(', ')}`
              : 'Totais de operações agrupados por CFOP conforme escrituração no SPED'}
          </p>
        </div>
        {isDashFiltered && cfopRowsFiltered.length === 0 && (
          <p className="px-5 py-4 text-xs text-muted-foreground">Nenhum CFOP encontrado para o filtro informado.</p>
        )}
        {cfopRows.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum registro C190 encontrado no SPED.</p>
          </div>
        ) : cfopRowsFiltered.length > 0 ? (
          <>
            <TableScrollWrapper>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <Th>CFOP</Th>
                    <Th>CST ICMS</Th>
                    <Th>Alíq. ICMS %</Th>
                    <Th right>VL Base ICMS</Th>
                    <Th right>VL ICMS</Th>
                    <Th right>VL BC ICMS ST</Th>
                    <Th right>VL ICMS ST</Th>
                    <Th right>VL Operação</Th>
                  </tr>
                </thead>
                <tbody>
                  {cfopRowsFiltered.map((row, i) => (
                    <tr key={row.cfop + row.cstIcms + i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                      <td className="px-3 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">{row.cfop}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{row.cstIcms}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums">{row.aliqIcms > 0 ? `${row.aliqIcms}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlBcIcms > 0 ? BRL(row.vlBcIcms) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlIcms > 0 ? BRL(row.vlIcms) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlBcIcmsSt > 0 ? BRL(row.vlBcIcmsSt) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlIcmsSt > 0 ? BRL(row.vlIcmsSt) : '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-foreground">{BRL(row.vlOpr)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-primary/5 font-semibold border-t-2 border-primary/20">
                    <td className="px-3 py-2.5 text-xs font-bold text-primary" colSpan={3}>
                      {isDashFiltered ? `SUBTOTAL (${cfopRowsFiltered.length} CFOP${cfopRowsFiltered.length !== 1 ? 's' : ''})` : 'TOTAL'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" colSpan={2}>{BRL(totalCfopIcms)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" colSpan={2}>{BRL(totalCfopSt)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold text-primary">{BRL(totalCfopOpr)}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScrollWrapper>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── CFOP Agrupado Tab ─────────────────────────────────────────────────────────

function CfopAgrupadoTab({
  result,
  cfopFilterSet,
}: {
  result: NonNullable<ReturnType<typeof useConfront>['result']>
  cfopFilterSet: Set<string>
}) {
  const cfopSummary = result.dashboard?.cfopSummary ?? []
  const isFiltered  = cfopFilterSet.size > 0

  // cfopSummary filtrado (para tabelas)
  const activeSummary = isFiltered
    ? cfopSummary.filter(r => cfopFilterSet.has(r.cfop))
    : cfopSummary

  // Totais SPED (C190) para os CFOPs selecionados
  const filteredSpedOpr  = activeSummary.reduce((s, r) => s + r.vlOpr, 0)
  const filteredSpedIcms = activeSummary.reduce((s, r) => s + r.vlIcms, 0)
  const filteredSpedSt   = activeSummary.reduce((s, r) => s + r.vlIcmsSt, 0)
  const filteredSpedBc   = activeSummary.reduce((s, r) => s + r.vlBcIcms, 0)

  // Totais XML (xmlsNotInSped) para os CFOPs selecionados
  const xmlItemsAll = result.xmlsNotInSped ?? []
  const xmlItemsFiltered = isFiltered
    ? xmlItemsAll.filter(xml => {
        if (!xml.cfops) return false
        const xmlCfops = xml.cfops.split(/[\s,]+/).map(c => c.trim())
        return xmlCfops.some(c => cfopFilterSet.has(c))
      })
    : xmlItemsAll
  const filteredXmlVnf  = xmlItemsFiltered.reduce((s, r) => s + (Number(r.vNF)  || 0), 0)
  const filteredXmlIcms = xmlItemsFiltered.reduce((s, r) => s + (Number(r.vICMS) || 0), 0)
  const filteredXmlSt   = xmlItemsFiltered.reduce((s, r) => s + (Number(r.vST)   || 0), 0)

  type CfopGroup = {
    cfop: string; cstIcms: string
    vlBcIcms: number; vlIcms: number; vlBcIcmsSt: number; vlIcmsSt: number; vlOpr: number
  }

  function buildGrouped(source: typeof cfopSummary): CfopGroup[] {
    const map = new Map<string, CfopGroup>()
    for (const row of source) {
      const key = `${row.cfop}|${row.cstIcms}`
      const existing = map.get(key)
      if (existing) {
        existing.vlBcIcms   += row.vlBcIcms
        existing.vlIcms     += row.vlIcms
        existing.vlBcIcmsSt += row.vlBcIcmsSt
        existing.vlIcmsSt   += row.vlIcmsSt
        existing.vlOpr      += row.vlOpr
      } else {
        map.set(key, {
          cfop: row.cfop, cstIcms: row.cstIcms,
          vlBcIcms: row.vlBcIcms, vlIcms: row.vlIcms,
          vlBcIcmsSt: row.vlBcIcmsSt, vlIcmsSt: row.vlIcmsSt,
          vlOpr: row.vlOpr,
        })
      }
    }
    return [...map.values()].sort((a, b) =>
      a.cfop.localeCompare(b.cfop) || a.cstIcms.localeCompare(b.cstIcms),
    )
  }

  // CFOP 1xx/2xx/3xx = Entradas; 5xx/6xx/7xx = Saídas
  const entradas = buildGrouped(activeSummary.filter(r => ['1','2','3'].includes(r.cfop[0])))
  const saidas   = buildGrouped(activeSummary.filter(r => ['5','6','7'].includes(r.cfop[0])))

  const totals = (rows: CfopGroup[]) => ({
    opr:  rows.reduce((s, r) => s + r.vlOpr, 0),
    icms: rows.reduce((s, r) => s + r.vlIcms, 0),
    st:   rows.reduce((s, r) => s + r.vlIcmsSt, 0),
  })

  const totalEnt = totals(entradas)
  const totalSai = totals(saidas)
  const totalGeral = {
    opr:  totalEnt.opr  + totalSai.opr,
    icms: totalEnt.icms + totalSai.icms,
    st:   totalEnt.st   + totalSai.st,
  }

  function CfopTable({ rows, sectionTotal }: { rows: CfopGroup[]; sectionTotal: typeof totalEnt }) {
    if (rows.length === 0) {
      return <p className="px-6 py-4 text-xs text-muted-foreground">Nenhum registro nesta direção.</p>
    }
    return (
      <TableScrollWrapper>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0d1f30]/80 text-white text-left">
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap">CFOP</th>
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap">CST ICMS</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">VL BC ICMS</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">VL ICMS</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">VL BC ST</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">VL ICMS ST</th>
              <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">VL Operação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.cfop + row.cstIcms} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                <td className="px-3 py-2.5 font-mono font-semibold text-primary whitespace-nowrap">{row.cfop}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{row.cstIcms}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlBcIcms  > 0 ? BRL(row.vlBcIcms)  : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlIcms    > 0 ? BRL(row.vlIcms)    : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlBcIcmsSt > 0 ? BRL(row.vlBcIcmsSt) : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{row.vlIcmsSt  > 0 ? BRL(row.vlIcmsSt)  : '—'}</td>
                <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-foreground">{BRL(row.vlOpr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-primary/5 font-semibold border-t-2 border-primary/20">
              <td className="px-3 py-2 text-xs font-bold text-primary" colSpan={2}>SUBTOTAL</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums" colSpan={2}>{BRL(sectionTotal.icms)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums" colSpan={2}>{BRL(sectionTotal.st)}</td>
              <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-primary">{BRL(sectionTotal.opr)}</td>
            </tr>
          </tfoot>
        </table>
      </TableScrollWrapper>
    )
  }

  if (cfopSummary.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-white shadow-sm p-10 text-center">
        <p className="text-sm text-muted-foreground">Nenhum registro C190 encontrado no SPED.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── Painel de comparação SPED vs XML (apenas quando filtrado) ── */}
      {isFiltered && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-primary">
            Resultado — {[...cfopFilterSet].join(', ')} ({activeSummary.length} linha{activeSummary.length !== 1 ? 's' : ''} C190)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {/* SPED */}
            <div className="col-span-2 sm:col-span-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-primary/20 bg-white px-3 py-2.5">
                <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-0.5">SPED — VL Operação</p>
                <p className="text-sm font-bold text-primary tabular-nums">R$ {BRL(filteredSpedOpr)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">C190 VL_OPR (referência fiscal)</p>
              </div>
              <div className="rounded-md border border-border bg-white px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">SPED — BC ICMS</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">R$ {BRL(filteredSpedBc)}</p>
              </div>
              <div className="rounded-md border border-border bg-white px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground mb-0.5">SPED — VL ICMS</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">R$ {BRL(filteredSpedIcms)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">ST: R$ {BRL(filteredSpedSt)}</p>
              </div>
            </div>
            {/* XML */}
            <div className="col-span-2 sm:col-span-3 grid grid-cols-3 gap-2">
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-0.5">XML — VL NF</p>
                <p className="text-sm font-bold text-amber-800 tabular-nums">R$ {BRL(filteredXmlVnf)}</p>
                <p className="text-[9px] text-amber-600 mt-0.5">{xmlItemsFiltered.length} doc(s) não escriturado{xmlItemsFiltered.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                <p className="text-[10px] text-amber-700 mb-0.5">XML — VL ICMS</p>
                <p className="text-sm font-semibold text-amber-800 tabular-nums">R$ {BRL(filteredXmlIcms)}</p>
              </div>
              <div className="rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2.5">
                <p className="text-[10px] text-amber-700 mb-0.5">XML — VL ICMS ST</p>
                <p className="text-sm font-semibold text-amber-800 tabular-nums">R$ {BRL(filteredXmlSt)}</p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            * Valores XML referem-se apenas aos documentos <strong>não escriturados no SPED</strong> com o(s) CFOP(s) selecionado(s).
            Documentos conferidos (presentes em ambos) não são detalhados por CFOP individualmente.
          </p>
        </div>
      )}

      {/* Entradas */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-blue-50 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
          <p className="text-sm font-semibold text-blue-800">Entradas (CFOP 1xx / 2xx / 3xx)</p>
          {isFiltered && <span className="ml-auto text-xs text-blue-600">{entradas.length} CFOP{entradas.length !== 1 ? 's' : ''}</span>}
        </div>
        <CfopTable rows={entradas} sectionTotal={totalEnt} />
      </div>

      {/* Saídas */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-orange-50 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
          <p className="text-sm font-semibold text-orange-800">Saídas (CFOP 5xx / 6xx / 7xx)</p>
          {isFiltered && <span className="ml-auto text-xs text-orange-600">{saidas.length} CFOP{saidas.length !== 1 ? 's' : ''}</span>}
        </div>
        <CfopTable rows={saidas} sectionTotal={totalSai} />
      </div>

      {/* Total geral */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-3 flex flex-wrap items-center gap-6">
        <p className="text-xs font-bold text-primary">{isFiltered ? 'TOTAL FILTRADO' : 'TOTAL GERAL'}</p>
        <div className="flex gap-6 text-xs tabular-nums">
          <span className="text-muted-foreground">VL ICMS: <span className="font-semibold text-foreground">{BRL(totalGeral.icms)}</span></span>
          <span className="text-muted-foreground">VL ICMS ST: <span className="font-semibold text-foreground">{BRL(totalGeral.st)}</span></span>
          <span className="text-muted-foreground">VL Operação: <span className="font-bold text-primary">{BRL(totalGeral.opr)}</span></span>
        </div>
      </div>
    </div>
  )
}

function TpNFBadge({ tpNF }: { tpNF?: string }) {
  if (tpNF === '1') return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-orange-50 text-orange-700 ring-1 ring-orange-200">Saída</span>
  if (tpNF === '0') return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-blue-50 text-blue-700 ring-1 ring-blue-200">Entrada</span>
  return <span className="text-muted-foreground">—</span>
}

function AuthBadge({ cStat }: { cStat?: string }) {
  if (!cStat) {
    return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-gray-100 text-gray-600 ring-1 ring-gray-200">Sem protocolo</span>
  }
  const label = CSTAT_LABEL[cStat] ?? `cStat ${cStat}`
  const isCancel = ['101', '135', '155'].includes(cStat)
  const isDenied = ['110', '301', '302'].includes(cStat)
  const cls = isCancel
    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
    : isDenied
      ? 'bg-red-100 text-red-700 ring-1 ring-red-200'
      : 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', cls)}>{cStat} — {label}</span>
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
      <p className="text-sm font-medium text-emerald-700">{label}</p>
    </div>
  )
}

function Pagination({ total, page, pageSize, onChange }: {
  total: number; page: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-[#F8FAFC]">
      <p className="text-xs text-muted-foreground">
        {(page * pageSize + 1).toLocaleString('pt-BR')}–{Math.min((page + 1) * pageSize, total).toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} registros
      </p>
      <div className="flex gap-1">
        <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}
          className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-backgroundMuted transition-colors">
          ← Anterior
        </button>
        <button type="button" disabled={page >= totalPages - 1} onClick={() => onChange(page + 1)}
          className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-backgroundMuted transition-colors">
          Próximo →
        </button>
      </div>
    </div>
  )
}

// ── Cancelamentos Tab ──────────────────────────────────────────────────────────

const CANCEL_SITUACAO: Record<string, { label: string; cls: string; dot: string }> = {
  ok:      { label: 'Cancelado em ambos',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  atencao: { label: 'Ativo no SPED!',         cls: 'bg-red-50    text-red-700    border-red-200',       dot: 'bg-red-500'     },
  info:    { label: 'Não escriturada',         cls: 'bg-gray-50   text-gray-600   border-gray-200',      dot: 'bg-gray-400'    },
}

function CancelamentosTab({
  items, slice, page, onPageChange,
}: {
  items: CancelamentoItem[]
  slice: CancelamentoItem[]
  page: number
  onPageChange: (p: number) => void
}) {
  const totalAtencao = items.filter((i) => i.situacao === 'atencao').length

  return (
    <div className="space-y-4">
      {/* Legenda */}
      <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Eventos de Cancelamento (tpEvento 110111)</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Arquivos XML reconhecidos como eventos de cancelamento de NF-e. Cada evento é cruzado com o SPED para verificar consistência.
        </p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(CANCEL_SITUACAO).map(([key, cfg]) => (
            <div key={key} className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium', cfg.cls)}>
              <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
              {cfg.label}
            </div>
          ))}
        </div>
        {totalAtencao > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700 font-medium">
              {totalAtencao} nota{totalAtencao !== 1 ? 's' : ''} cancelada{totalAtencao !== 1 ? 's' : ''} no XML mas escriturada{totalAtencao !== 1 ? 's' : ''} como <strong>ativa</strong> no SPED — requer ajuste!
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Nenhum evento de cancelamento encontrado.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Para processar cancelamentos, inclua os arquivos de evento XML (procEventoNFe) na pasta selecionada.
            </p>
          </div>
        ) : (
          <>
            <TableScrollWrapper>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-primary text-white">
                    <Th>Situação</Th>
                    <Th>Chave de Acesso (44)</Th>
                    <Th>Arquivo Evento</Th>
                    <Th>Nº NF</Th>
                    <Th>Dt Cancelamento</Th>
                    <Th>cStat Evento</Th>
                    <Th>Motivo SEFAZ</Th>
                    <Th>Justificativa</Th>
                    <Th>No SPED?</Th>
                    <Th>COD_SIT SPED</Th>
                    <Th right>VL DOC SPED</Th>
                    <Th>Registro</Th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((item, i) => {
                    const cfg = CANCEL_SITUACAO[item.situacao] ?? CANCEL_SITUACAO.info
                    return (
                      <tr key={item.chave + item.filename} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F2F5F7]'}>
                        <td className="px-3 py-2.5 align-top">
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap', cfg.cls)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="font-mono text-[10px] leading-relaxed text-foreground break-all">{item.chave}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block max-w-[180px] truncate text-muted-foreground" title={item.filename}>{item.filename}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap tabular-nums">{item.nNF || '—'}</td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap">{formatDate(item.dhCancelamento)}</td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            ['135', '136'].includes(item.cStatEvento)
                              ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                              : 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
                          )}>
                            {item.cStatEvento || '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block max-w-[200px] truncate text-muted-foreground" title={item.xMotivoEvento}>{item.xMotivoEvento || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className="block max-w-[200px] truncate text-muted-foreground" title={item.xJust}>{item.xJust || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            item.noSped
                              ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                              : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
                          )}>
                            {item.noSped ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          {item.noSped ? <SituacaoBadge codSit={item.codSitSped} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 align-top text-right whitespace-nowrap tabular-nums">
                          {item.vlDocSped != null && item.vlDocSped > 0
                            ? item.vlDocSped.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5 align-top font-mono whitespace-nowrap text-muted-foreground">
                          {item.registroSped || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </TableScrollWrapper>
            <Pagination total={items.length} page={page} pageSize={PAGE_SIZE} onChange={onPageChange} />
          </>
        )}
      </div>
    </div>
  )
}
