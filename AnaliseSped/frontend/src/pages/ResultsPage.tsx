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
} from 'lucide-react'

import { useConfront } from '@/confront/ConfrontContext'
import { usePage } from '@/App'
import { downloadExcel, downloadPdf, sendEmailReport } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AuditItem, CfopSummary, SpedItem, XmlItem } from '@/types/confront'

type TabId = 'auditoria' | 'dashboard' | 'cfop-agrupado' | 'resumo' | 'xml-sem-sped' | 'sped-sem-xml' | 'sem-autorizacao' | 'erros-leitura'

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
  const xmlSlice   = xmlItems.slice(xmlPage * PAGE_SIZE, (xmlPage + 1) * PAGE_SIZE)
  const spedSlice  = spedItems.slice(spedPage * PAGE_SIZE, (spedPage + 1) * PAGE_SIZE)
  const authSlice  = authItems.slice(authPage * PAGE_SIZE, (authPage + 1) * PAGE_SIZE)

  async function handleDownload(type: 'excel' | 'pdf') {
    if (!sessionId || !result) return
    type === 'excel' ? setDlExcel(true) : setDlPdf(true)
    try {
      const blob = type === 'excel' ? await downloadExcel(sessionId) : await downloadPdf(sessionId)
      const ext  = type === 'excel' ? 'xlsx' : 'pdf'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `confronto_${result.spedInfo.cnpj}_${result.spedInfo.dtIni}.${ext}`
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
  const semAuth = result.totalSemAutorizacao ?? authItems.length
  const summaryCards = [
    { label: 'Entradas SPED',       value: result.totalSpedEntries, icon: FileText,      color: 'text-primary',     bg: 'bg-primary/8' },
    { label: 'XMLs enviados',       value: result.totalXmls,        icon: FolderOpen,    color: 'text-secondary',   bg: 'bg-secondary/8' },
    { label: 'Conferidos (OK)',     value: result.totalMatches,     icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Divergências',        value: divergencias,            icon: AlertTriangle, color: divergencias > 0 ? 'text-red-500' : 'text-emerald-600', bg: divergencias > 0 ? 'bg-red-50' : 'bg-emerald-50' },
    { label: 'Sem autorização SEFAZ', value: semAuth,               icon: ShieldAlert,   color: semAuth > 0 ? 'text-orange-600' : 'text-emerald-600', bg: semAuth > 0 ? 'bg-orange-50' : 'bg-emerald-50' },
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
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            { id: 'sem-autorizacao' as TabId, label: `Sem autorização (${semAuth})`,               alert: semAuth > 0 },
            { id: 'erros-leitura'   as TabId, label: `Erros de leitura (${result.xmlErrors.length})`, alert: result.xmlErrors.length > 0 },
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

        {/* ── Aba Auditoria Fiscal ──────────────────────────────────────── */}
        {activeTab === 'auditoria' && (
          <AuditoriaTab result={result} />
        )}

        {/* ── Aba Dashboard ─────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <DashboardTab result={result} />
        )}

        {/* ── Aba CFOP Agrupado ─────────────────────────────────────────── */}
        {activeTab === 'cfop-agrupado' && (
          <CfopAgrupadoTab result={result} />
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
                        <Th right>Valor (R$)</Th>
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
                          <td className="px-3 py-2.5 align-top text-right whitespace-nowrap tabular-nums">
                            {item.vNF ? Number(item.vNF).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                          </td>
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
                        <Th right>Valor (R$)</Th>
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
                          <td className="px-3 py-2.5 align-top text-right whitespace-nowrap tabular-nums">
                            {item.vlDoc != null ? item.vlDoc.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                          </td>
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

function AuditoriaTab({ result }: { result: NonNullable<ReturnType<typeof useConfront>['result']> }) {
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

  return (
    <div className="flex flex-col gap-4">

      {/* Veredicto */}
      <div className={cn('rounded-xl border-2 p-5 flex items-start gap-4', cfg.bg, cfg.border)}>
        <span className={cn('mt-0.5 h-4 w-4 rounded-full shrink-0', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <p className={cn('text-base font-bold tracking-wide', cfg.text)}>{cfg.label}</p>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', cfg.badge)}>
              Auditoria Fiscal SPED × XML
            </span>
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
          <p className="mt-0.5 text-xs text-muted-foreground">De onde vem a diferença entre o total SPED e o total XML</p>
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
              <tr className="bg-white border-b border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">Pares conferidos (chave OK)</p>
                  <p className="text-muted-foreground">Documentos presentes nos dois lados</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{audit.matchedCount}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{BRL(audit.totalVlSpedMatched)}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{BRL(audit.totalVlXmlMatched)}</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', Math.abs(matchedDiff) > 0.01 ? 'text-red-600' : 'text-emerald-600')}>
                  {Math.abs(matchedDiff) > 0.01 ? BRL(Math.abs(matchedDiff)) : '—'}
                </td>
              </tr>
              <tr className="bg-[#F2F5F7] border-b border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">XMLs sem escrituração no SPED</p>
                  <p className="text-muted-foreground">XMLs enviados que não constam no SPED</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{result.xmlsNotInSped.length}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap', audit.totalVlXmlNotInSped > 0 ? 'text-red-600 font-semibold' : '')}>
                  {audit.totalVlXmlNotInSped > 0 ? BRL(audit.totalVlXmlNotInSped) : '—'}
                </td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', audit.totalVlXmlNotInSped > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {audit.totalVlXmlNotInSped > 0 ? BRL(audit.totalVlXmlNotInSped) : '—'}
                </td>
              </tr>
              <tr className="bg-white border-b border-border">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">SPED sem XML correspondente</p>
                  <p className="text-muted-foreground">Chaves no SPED sem arquivo XML enviado</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{result.spedNotInXml.length}</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap', audit.totalVlSpedNotInXml > 0 ? 'text-red-600 font-semibold' : '')}>
                  {audit.totalVlSpedNotInXml > 0 ? BRL(audit.totalVlSpedNotInXml) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold', audit.totalVlSpedNotInXml > 0 ? 'text-red-600' : 'text-emerald-600')}>
                  {audit.totalVlSpedNotInXml > 0 ? BRL(audit.totalVlSpedNotInXml) : '—'}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold">
                <td className="px-4 py-2.5 text-xs font-bold text-primary">TOTAL GERAL</td>
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

function DashboardTab({ result }: { result: NonNullable<ReturnType<typeof useConfront>['result']> }) {
  const db = result.dashboard ?? {
    totalVlSpedGeral: 0, totalVlSpedEntradas: 0, totalVlSpedSaidas: 0,
    totalVlXmlGeral: 0,  totalVlXmlEntradas: 0,  totalVlXmlSaidas: 0,
    cfopSummary: [],
  }

  const cfopRows: CfopSummary[] = [...db.cfopSummary].sort((a, b) =>
    a.cfop.localeCompare(b.cfop),
  )

  const totalCfopOpr  = cfopRows.reduce((s, r) => s + r.vlOpr, 0)
  const totalCfopIcms = cfopRows.reduce((s, r) => s + r.vlIcms, 0)
  const totalCfopSt   = cfopRows.reduce((s, r) => s + r.vlIcmsSt, 0)

  return (
    <div className="space-y-5">

      {/* ── Totais SPED ── */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">S</span>
          Valores apurados — SPED Fiscal
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Total geral (VL_DOC)',  value: db.totalVlSpedGeral,    cls: 'text-primary' },
            { label: 'Entradas (IND_OPER=0)', value: db.totalVlSpedEntradas, cls: 'text-blue-600' },
            { label: 'Saídas (IND_OPER=1)',   value: db.totalVlSpedSaidas,   cls: 'text-orange-600' },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-lg border border-border bg-[#F8FAFC] px-4 py-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-lg font-bold tabular-nums', cls)}>R$ {BRL(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Totais XML ── */}
      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/10 text-[10px] font-bold text-secondary">X</span>
          Valores apurados — XMLs enviados
        </h3>
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
      </div>

      {/* ── Resumo por CFOP ── */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-foreground">Resumo por CFOP — Registro C190</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Totais de operações agrupados por CFOP conforme escrituração no SPED</p>
        </div>
        {cfopRows.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum registro C190 encontrado no SPED.</p>
          </div>
        ) : (
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
                  {cfopRows.map((row, i) => (
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
                    <td className="px-3 py-2.5 text-xs font-bold text-primary" colSpan={3}>TOTAL</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" colSpan={2}>{BRL(totalCfopIcms)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums" colSpan={2}>{BRL(totalCfopSt)}</td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums font-bold text-primary">{BRL(totalCfopOpr)}</td>
                  </tr>
                </tfoot>
              </table>
            </TableScrollWrapper>
          </>
        )}
      </div>
    </div>
  )
}

// ── CFOP Agrupado Tab ─────────────────────────────────────────────────────────

function CfopAgrupadoTab({ result }: { result: NonNullable<ReturnType<typeof useConfront>['result']> }) {
  const cfopSummary = result.dashboard?.cfopSummary ?? []

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
  const entradas = buildGrouped(cfopSummary.filter(r => ['1','2','3'].includes(r.cfop[0])))
  const saidas   = buildGrouped(cfopSummary.filter(r => ['5','6','7'].includes(r.cfop[0])))

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
      {/* Entradas */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-blue-50 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
          <p className="text-sm font-semibold text-blue-800">Entradas (CFOP 1xx / 2xx / 3xx)</p>
        </div>
        <CfopTable rows={entradas} sectionTotal={totalEnt} />
      </div>

      {/* Saídas */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-orange-50 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shrink-0" />
          <p className="text-sm font-semibold text-orange-800">Saídas (CFOP 5xx / 6xx / 7xx)</p>
        </div>
        <CfopTable rows={saidas} sectionTotal={totalSai} />
      </div>

      {/* Total geral */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-3 flex flex-wrap items-center gap-6">
        <p className="text-xs font-bold text-primary">TOTAL GERAL</p>
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
