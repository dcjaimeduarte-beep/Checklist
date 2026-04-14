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
} from 'lucide-react'

import { useConfront } from '@/confront/ConfrontContext'
import { usePage } from '@/App'
import { downloadExcel, downloadPdf, sendEmailReport } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SpedItem, XmlItem } from '@/types/confront'

type TabId = 'resumo' | 'xml-sem-sped' | 'sped-sem-xml'

const SITUACAO_MAP: Record<string, { label: string; cls: string }> = {
  '00': { label: 'Regular', cls: 'bg-green-100 text-green-700' },
  '01': { label: 'Regular (ext.)', cls: 'bg-green-100 text-green-700' },
  '02': { label: 'Cancelada', cls: 'bg-yellow-100 text-yellow-700' },
  '03': { label: 'Canc. (ext.)', cls: 'bg-yellow-100 text-yellow-700' },
  '04': { label: 'Denegada', cls: 'bg-red-100 text-red-700' },
  '06': { label: 'Complementar', cls: 'bg-blue-100 text-blue-700' },
  '07': { label: 'Canc. ext.', cls: 'bg-yellow-100 text-yellow-700' },
  '08': { label: 'Devolução', cls: 'bg-purple-100 text-purple-700' },
}

const MODELO_MAP: Record<string, string> = {
  '55': 'NF-e',
  '65': 'NFC-e',
  '57': 'CT-e',
  '67': 'CT-e OS',
}

function formatDate(dt?: string): string {
  if (!dt) return '—'
  if (dt.includes('T') || dt.includes('-')) {
    return new Date(dt).toLocaleDateString('pt-BR')
  }
  if (dt.length === 8) return `${dt.slice(0, 2)}/${dt.slice(2, 4)}/${dt.slice(4, 8)}`
  return dt
}

function truncateChave(chave: string) {
  return (
    <span title={chave} className="font-mono text-[11px]">
      {chave.slice(0, 20)}…{chave.slice(-8)}
    </span>
  )
}

function SituacaoBadge({ codSit }: { codSit?: string }) {
  const info = SITUACAO_MAP[codSit ?? ''] ?? { label: codSit ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', info.cls)}>
      {info.label}
    </span>
  )
}

export function ResultsPage() {
  const { result, sessionId, reset } = useConfront()
  const { setPage } = usePage()
  const [activeTab, setActiveTab] = useState<TabId>('resumo')
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [xmlPage, setXmlPage] = useState(0)
  const [spedPage, setSpedPage] = useState(0)

  const PAGE_SIZE = 50

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-backgroundMuted">
        <div className="text-center">
          <ClipboardCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum confronto realizado ainda.</p>
          <Button className="mt-4 cursor-pointer" onClick={() => setPage('upload')}>
            Ir para Upload
          </Button>
        </div>
      </div>
    )
  }

  const divergencias = result.xmlsNotInSped.length + result.spedNotInXml.length

  async function handleDownloadExcel() {
    if (!sessionId) return
    setDownloadingExcel(true)
    try {
      const blob = await downloadExcel(sessionId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `confronto_${result.spedInfo.cnpj}_${result.spedInfo.dtIni}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingExcel(false)
    }
  }

  async function handleDownloadPdf() {
    if (!sessionId) return
    setDownloadingPdf(true)
    try {
      const blob = await downloadPdf(sessionId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `confronto_${result.spedInfo.cnpj}_${result.spedInfo.dtIni}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function handleSendEmail() {
    if (!sessionId || !emailTo) return
    setEmailLoading(true)
    setEmailError(null)
    try {
      await sendEmailReport(sessionId, emailTo, emailMsg || undefined)
      setEmailSuccess(true)
      setTimeout(() => { setEmailOpen(false); setEmailSuccess(false) }, 2000)
    } catch (err) {
      setEmailError((err as Error).message)
    } finally {
      setEmailLoading(false)
    }
  }

  const xmlItems: XmlItem[] = result.xmlsNotInSped
  const spedItems: SpedItem[] = result.spedNotInXml

  const xmlSlice = xmlItems.slice(xmlPage * PAGE_SIZE, (xmlPage + 1) * PAGE_SIZE)
  const spedSlice = spedItems.slice(spedPage * PAGE_SIZE, (spedPage + 1) * PAGE_SIZE)

  return (
    <div className="flex min-h-screen flex-col bg-backgroundMuted">
      {/* Header */}
      <header className="border-b border-border bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPage('upload')}
              className="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Novo confronto
            </button>
            <span className="text-border">|</span>
            <div>
              <h1 className="text-sm font-semibold text-primary">AnaliseSped</h1>
              <p className="text-xs text-muted-foreground">Resultado do confronto</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 text-xs"
              onClick={handleDownloadExcel}
              disabled={downloadingExcel}
            >
              {downloadingExcel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer gap-1.5 text-xs"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button
              size="sm"
              className="cursor-pointer gap-1.5 text-xs"
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="h-3.5 w-3.5" />
              Enviar por e-mail
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
        {/* Cards resumo */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'Entradas SPED', value: result.totalSpedEntries, icon: FileText, color: 'text-primary' },
            { label: 'XMLs enviados', value: result.totalXmls, icon: FolderOpen, color: 'text-secondary' },
            {
              label: 'Conferidos (OK)', value: result.totalMatches,
              icon: CheckCircle2, color: 'text-green-600',
            },
            {
              label: 'Divergências', value: divergencias,
              icon: AlertTriangle, color: divergencias > 0 ? 'text-red-500' : 'text-green-600',
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={cn('h-4 w-4', color)} />
              </div>
              <p className={cn('mt-2 text-2xl font-bold', color)}>{value.toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>

        {/* Info SPED */}
        <div className="mb-4 rounded-xl border border-border bg-white px-5 py-3 shadow-sm">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="text-foreground">Empresa:</strong> {result.spedInfo.nome}</span>
            <span><strong className="text-foreground">CNPJ:</strong> {result.spedInfo.cnpj}</span>
            <span><strong className="text-foreground">UF:</strong> {result.spedInfo.uf}</span>
            <span><strong className="text-foreground">Período:</strong> {formatDate(result.spedInfo.dtIni)} a {formatDate(result.spedInfo.dtFin)}</span>
            <span><strong className="text-foreground">Arquivo:</strong> {result.spedFilename}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 rounded-xl border border-border bg-white p-1 shadow-sm w-fit">
          {([
            { id: 'resumo' as TabId, label: 'Resumo' },
            { id: 'xml-sem-sped' as TabId, label: `XMLs não no SPED (${result.xmlsNotInSped.length})` },
            { id: 'sped-sem-xml' as TabId, label: `SPED sem XML (${result.spedNotInXml.length})` },
          ]).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                'cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                activeTab === id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Conteúdo das abas */}
        {activeTab === 'resumo' && (
          <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Resultado do confronto</h3>

            {divergencias === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <CheckCircle2 className="mb-3 h-12 w-12 text-green-500" />
                <p className="text-base font-semibold text-green-700">Nenhuma divergência encontrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Todos os {result.totalMatches.toLocaleString('pt-BR')} documentos foram conferidos com sucesso.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.xmlsNotInSped.length > 0 && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">
                        {result.xmlsNotInSped.length} XML{result.xmlsNotInSped.length !== 1 ? 's' : ''} não escriturado{result.xmlsNotInSped.length !== 1 ? 's' : ''} no SPED
                      </p>
                      <p className="mt-0.5 text-xs text-red-600">
                        Estes documentos existem na pasta de XMLs mas não constam no arquivo SPED Fiscal.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-auto cursor-pointer text-xs text-red-500 hover:underline shrink-0"
                      onClick={() => setActiveTab('xml-sem-sped')}
                    >
                      Ver lista →
                    </button>
                  </div>
                )}
                {result.spedNotInXml.length > 0 && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-amber-700">
                        {result.spedNotInXml.length} entrada{result.spedNotInXml.length !== 1 ? 's' : ''} no SPED sem XML correspondente
                      </p>
                      <p className="mt-0.5 text-xs text-amber-600">
                        Estes registros constam no SPED mas o arquivo XML não foi localizado na pasta selecionada.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ml-auto cursor-pointer text-xs text-amber-600 hover:underline shrink-0"
                      onClick={() => setActiveTab('sped-sem-xml')}
                    >
                      Ver lista →
                    </button>
                  </div>
                )}
                {result.xmlErrors.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs font-medium text-gray-600">
                      {result.xmlErrors.length} arquivo{result.xmlErrors.length !== 1 ? 's' : ''} XML com erro de leitura (ignorado{result.xmlErrors.length !== 1 ? 's' : ''})
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'xml-sem-sped' && (
          <div className="rounded-xl border border-border bg-white shadow-sm">
            {xmlItems.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-green-700">Todos os XMLs estão escriturados no SPED.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-primary text-white">
                      {['Chave de Acesso', 'Arquivo XML', 'Tipo', 'Nº NF', 'Série', 'Emissão', 'CNPJ Emit.', 'Emitente', 'Valor (R$)'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {xmlSlice.map((item, i) => (
                      <tr key={item.chave} className={i % 2 === 0 ? 'bg-white' : 'bg-backgroundMuted/50'}>
                        <td className="px-3 py-2">{truncateChave(item.chave)}</td>
                        <td className="px-3 py-2 text-muted-foreground" title={item.filename}>{item.filename.slice(-30)}</td>
                        <td className="px-3 py-2"><span className="rounded bg-secondary/10 px-1.5 py-0.5 text-[10px] font-medium text-secondary">{item.tipo}</span></td>
                        <td className="px-3 py-2">{item.nNF ?? '—'}</td>
                        <td className="px-3 py-2">{item.serie ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.dhEmi)}</td>
                        <td className="px-3 py-2 font-mono">{item.cnpjEmit ?? '—'}</td>
                        <td className="px-3 py-2" title={item.xNomeEmit}>{item.xNomeEmit?.slice(0, 25) ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{item.vNF ? Number(item.vNF).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  total={xmlItems.length}
                  page={xmlPage}
                  pageSize={PAGE_SIZE}
                  onChange={setXmlPage}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'sped-sem-xml' && (
          <div className="rounded-xl border border-border bg-white shadow-sm">
            {spedItems.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <CheckCircle2 className="mb-3 h-10 w-10 text-green-500" />
                <p className="text-sm font-medium text-green-700">Todos os registros SPED têm XML correspondente.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-primary text-white">
                      {['Chave de Acesso', 'Registro', 'Modelo', 'Série', 'Nº Doc', 'Data Doc', 'Situação', 'Operação'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {spedSlice.map((item, i) => (
                      <tr key={item.chave} className={i % 2 === 0 ? 'bg-white' : 'bg-backgroundMuted/50'}>
                        <td className="px-3 py-2">{truncateChave(item.chave)}</td>
                        <td className="px-3 py-2 font-mono">{item.registro}</td>
                        <td className="px-3 py-2">{MODELO_MAP[item.codMod ?? ''] ?? item.codMod ?? '—'}</td>
                        <td className="px-3 py-2">{item.ser ?? '—'}</td>
                        <td className="px-3 py-2">{item.numDoc ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(item.dtDoc)}</td>
                        <td className="px-3 py-2"><SituacaoBadge codSit={item.codSit} /></td>
                        <td className="px-3 py-2">{item.indOper === '0' ? 'Entrada' : 'Saída'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  total={spedItems.length}
                  page={spedPage}
                  pageSize={PAGE_SIZE}
                  onChange={setSpedPage}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => { reset(); setPage('upload') }}
            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Limpar e fazer novo confronto
          </button>
        </div>
      </main>

      {/* Modal e-mail */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Enviar relatório por e-mail</h2>
              <button type="button" onClick={() => setEmailOpen(false)} className="cursor-pointer text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Destinatário</label>
                <input
                  type="email"
                  className="h-10 w-full rounded-lg border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="email@empresa.com.br"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Mensagem (opcional)</label>
                <textarea
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  rows={3}
                  placeholder="Segue em anexo o relatório de confronto SPED x XML..."
                  value={emailMsg}
                  onChange={(e) => setEmailMsg(e.target.value)}
                />
              </div>
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
              {emailSuccess && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-green-700">E-mail enviado com sucesso!</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEmailOpen(false)} className="cursor-pointer">
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!emailTo || emailLoading}
                onClick={handleSendEmail}
                className="cursor-pointer gap-1.5"
              >
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

function Pagination({
  total,
  page,
  pageSize,
  onChange,
}: {
  total: number
  page: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3">
      <p className="text-xs text-muted-foreground">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} de {total.toLocaleString('pt-BR')}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="cursor-pointer rounded border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-backgroundMuted"
        >
          ← Anterior
        </button>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          className="cursor-pointer rounded border border-border px-2 py-1 text-xs disabled:opacity-40 hover:bg-backgroundMuted"
        >
          Próximo →
        </button>
      </div>
    </div>
  )
}
