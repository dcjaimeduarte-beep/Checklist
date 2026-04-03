import { useState, useRef, useEffect } from 'react'
import { usePage } from '@/App'
import {
  Loader2, LogOut, Upload, Download, FileSpreadsheet,
  CheckCircle2, Search, AlertCircle, Play,
  Clock, BarChart3, FileDown, Trash2, ChevronDown,
  RefreshCw, FileUp, FileCode2,
} from 'lucide-react'

import { AppLogo } from '@/components/AppLogo'
import { useAuth } from '@/auth/AuthContext'
import { useBatch, type BatchItem } from '@/batch/BatchContext'
import { useXmlBatch } from '@/batch/XmlBatchContext'
import { Button } from '@/components/ui/button'

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  return m > 0 ? `${m}m ${(s % 60).toString().padStart(2, '0')}s` : `${s}s`
}

function ElapsedTimer({ startedAt, fileSize }: { startedAt: number; fileSize: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500)
    return () => clearInterval(iv)
  }, [startedAt])
  const eta = Math.max(2, Math.ceil((fileSize / 102400) * 3.5))
  const rem = Math.max(0, eta - elapsed)
  return (
    <span className="text-[11px] text-muted-foreground tabular-nums">
      {formatTime(elapsed)}{rem > 0 && <span className="text-muted-foreground/50"> · ~{formatTime(rem)}</span>}
    </span>
  )
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  accent: 'navy' | 'teal' | 'amber' | 'red'
}) {
  const styles = {
    navy: { card: 'bg-white', icon: 'bg-primary/5 text-primary', text: 'text-foreground', sub: 'text-muted-foreground' },
    teal: { card: 'bg-white', icon: 'bg-secondary/10 text-secondary', text: 'text-foreground', sub: 'text-muted-foreground' },
    amber: { card: 'bg-white', icon: 'bg-amber-50 text-amber-600', text: 'text-foreground', sub: 'text-muted-foreground' },
    red: { card: 'bg-white', icon: 'bg-red-50 text-red-500', text: 'text-foreground', sub: 'text-muted-foreground' },
  }
  const s = styles[accent]
  return (
    <div className={`rounded-xl border border-border p-4 flex items-center gap-3.5 ${s.card}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.icon}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className={`text-[22px] font-bold leading-none tabular-nums ${s.text}`}>{value}</p>
        <p className={`text-[11px] mt-0.5 ${s.sub}`}>{label}</p>
      </div>
    </div>
  )
}

/* ── File Row (table-like) ── */
function FileRow({ item, onRemove, onProcess, icon: RowIcon = FileSpreadsheet }: {
  item: BatchItem
  onRemove: () => void
  onProcess: () => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  const statusConfig = {
    pending: { label: 'Pendente', dotColor: 'bg-amber-400', textColor: 'text-amber-700' },
    processing: { label: 'Processando...', dotColor: 'bg-secondary', textColor: 'text-secondary' },
    done: { label: 'Concluido', dotColor: 'bg-emerald-500', textColor: 'text-emerald-700' },
    error: { label: 'Erro', dotColor: 'bg-red-400', textColor: 'text-red-600' },
  }
  const sc = statusConfig[item.status]
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-background-muted/50 transition-colors group">
      <RowIcon className={`h-5 w-5 shrink-0 ${
        item.status === 'done' ? 'text-emerald-500' : item.status === 'error' ? 'text-red-400' : 'text-secondary'
      }`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground truncate">{item.fileName}</p>
        <p className="text-[11px] text-muted-foreground">{(item.fileSize / 1024).toFixed(0)} KB</p>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${sc.dotColor}`} />
        <span className={`text-[11px] font-medium ${sc.textColor}`}>{sc.label}</span>
      </div>
      {item.status === 'processing' && item.startedAt && (
        <ElapsedTimer startedAt={item.startedAt} fileSize={item.fileSize} />
      )}
      {item.status === 'error' && item.error && (
        <span className="hidden md:block text-[11px] text-red-500 max-w-[200px] truncate" title={item.error}>{item.error}</span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {item.status === 'pending' && (
          <Button type="button" size="sm" onClick={onProcess} className="cursor-pointer">
            <Play className="h-3 w-3" aria-hidden />
            <span className="hidden sm:inline">Processar</span>
          </Button>
        )}
        {item.status === 'processing' && (
          <Loader2 className="h-4 w-4 animate-spin text-secondary" aria-hidden />
        )}
        {item.status === 'done' && item.downloadUrl && (
          <a href={item.downloadUrl} download={item.downloadName} className="cursor-pointer">
            <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer">
              <Download className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">Baixar</span>
            </Button>
          </a>
        )}
        {item.status === 'error' && (
          <Button type="button" size="sm" variant="outline" onClick={onProcess} className="cursor-pointer">
            <RefreshCw className="h-3 w-3" aria-hidden /> Tentar novamente
          </Button>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 rounded-md text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

/* ── Empty state for XLSX file list ── */
function EmptyFileList() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-muted mb-3">
        <FileSpreadsheet className="h-5 w-5 text-muted-foreground/50" aria-hidden />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nenhuma planilha adicionada</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[240px]">
        Arraste arquivos .xlsx na area de upload ou clique para selecionar
      </p>
    </div>
  )
}

/* ── Empty state for XML file list ── */
function EmptyXmlList() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-background-muted mb-3">
        <FileCode2 className="h-5 w-5 text-muted-foreground/50" aria-hidden />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Nenhum XML adicionado</p>
      <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[240px]">
        Arraste arquivos .xml (NF-e) na area de upload ou clique para selecionar
      </p>
    </div>
  )
}

/* ── Progress bar for overall batch ── */
function BatchProgress({ items }: { items: BatchItem[] }) {
  if (items.length === 0) return null
  const done = items.filter(i => i.status === 'done').length
  const errors = items.filter(i => i.status === 'error').length
  const processing = items.filter(i => i.status === 'processing').length
  const total = items.length
  const pctDone = (done / total) * 100
  const pctError = (errors / total) * 100
  const pctProcessing = (processing / total) * 100
  return (
    <div className="px-4 py-3 border-b border-border bg-background-muted/30">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Progresso geral</span>
        <span className="text-[11px] font-semibold text-foreground tabular-nums">{done}/{total} concluidas</span>
      </div>
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden flex">
        {pctDone > 0 && <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctDone}%` }} />}
        {pctProcessing > 0 && <div className="h-full bg-secondary animate-pulse transition-all duration-500" style={{ width: `${pctProcessing}%` }} />}
        {pctError > 0 && <div className="h-full bg-red-400 transition-all duration-500" style={{ width: `${pctError}%` }} />}
      </div>
    </div>
  )
}

/* ── Collapsible templates ── */
function CollapsibleTemplates() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-white border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-background-muted/30 transition-colors"
      >
        <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
          <FileDown className="h-4 w-4 text-secondary" aria-hidden />
          Templates de exemplo
        </h2>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Baixe um modelo de planilha para preencher com seus dados NCM.
          </p>
          <div className="space-y-1.5">
            <a
              href="/api/batch/template/NCM%20IGRAMAL.xlsx"
              download
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-background-muted transition-colors cursor-pointer group"
            >
              <FileSpreadsheet className="h-4 w-4 text-secondary shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground truncate">NCM IGRAMAL.xlsx</p>
                <p className="text-[10px] text-muted-foreground">Modelo com NCMs de exemplo</p>
              </div>
              <Download className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-secondary transition-colors" aria-hidden />
            </a>
            <a
              href="/api/batch/template/Planilha%20grao%20de%20ouro.xlsx"
              download
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-background-muted transition-colors cursor-pointer group"
            >
              <FileSpreadsheet className="h-4 w-4 text-secondary shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium text-foreground truncate">Planilha grao de ouro.xlsx</p>
                <p className="text-[10px] text-muted-foreground">Modelo com NCMs de exemplo</p>
              </div>
              <Download className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-secondary transition-colors" aria-hidden />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Collapsible help ── */
function CollapsibleHelp({ tab }: { tab: 'xlsx' | 'xml' }) {
  const [open, setOpen] = useState(false)
  const xlsxSteps = [
    'Faça upload de uma planilha .xlsx com a coluna NCM',
    'Clique em "Processar" para enriquecer com dados tributários',
    'Baixe a planilha com as colunas adicionais da reforma',
  ]
  const xmlSteps = [
    'Faça upload de um arquivo .xml de NF-e',
    'O sistema lê automaticamente os itens (NCM e descrição)',
    'Clique em "Processar" para gerar a planilha tributária',
    'Baixe o .xlsx com todos os campos da reforma tributária',
  ]
  const steps = tab === 'xml' ? xmlSteps : xlsxSteps
  return (
    <div className="rounded-xl bg-white border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-background-muted/30 transition-colors"
      >
        <h2 className="text-[13px] font-semibold text-foreground">Como funciona</h2>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          <ol className="space-y-3">
            {steps.map((text, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[11px] font-bold text-secondary">
                  {i + 1}
                </span>
                <p className="text-[12px] text-muted-foreground leading-relaxed pt-0.5">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

/* ── Main page ── */
export function BatchPage() {
  const { logout } = useAuth()
  const { setPage } = usePage()

  /* XLSX state */
  const { items, addFiles, removeItem, processItem, processAll } = useBatch()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  /* XML state */
  const xml = useXmlBatch()
  const xmlFileRef = useRef<HTMLInputElement>(null)
  const [xmlDragOver, setXmlDragOver] = useState(false)
  const [xmlErr, setXmlErr] = useState<string | null>(null)

  /* Tab de upload */
  const [uploadTab, setUploadTab] = useState<'xlsx' | 'xml'>('xlsx')

  /* Stats XLSX */
  const totalCount = items.length
  const doneCount = items.filter(i => i.status === 'done').length
  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'processing').length
  const errorCount = items.filter(i => i.status === 'error').length

  /* Stats XML */
  const xmlTotalCount = xml.items.length
  const xmlDoneCount = xml.items.filter(i => i.status === 'done').length
  const xmlPendingCount = xml.items.filter(i => i.status === 'pending' || i.status === 'processing').length
  const xmlErrorCount = xml.items.filter(i => i.status === 'error').length

  const hasPending = items.some(i => i.status === 'pending')
  const isProcessing = items.some(i => i.status === 'processing')
  const xmlHasPending = xml.items.some(i => i.status === 'pending')
  const xmlIsProcessing = xml.items.some(i => i.status === 'processing')

  return (
    <div className="min-h-svh bg-background-muted flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-2 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo imgClassName="h-7 sm:h-8" />
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div className="hidden sm:block">
              <h1 className="text-[13px] font-semibold text-foreground leading-tight">Processamento em Lote</h1>
              <p className="text-[10px] text-muted-foreground">Upload de planilhas NCM</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage('consulta')} className="cursor-pointer">
              <Search className="h-3 w-3" aria-hidden /><span className="hidden sm:inline">Consulta</span>
            </Button>
            <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer">
              <FileSpreadsheet className="h-3 w-3" aria-hidden /><span className="hidden sm:inline">Lote</span>
            </Button>
            <div className="h-5 w-px bg-border" />
            <Button type="button" variant="outline" size="sm" onClick={() => void logout()} className="cursor-pointer">
              <LogOut className="h-3 w-3" aria-hidden /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Dashboard content ── */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:py-6 lg:px-6 flex-1">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard icon={BarChart3} label="Total de planilhas" value={totalCount} accent="navy" />
          <StatCard icon={CheckCircle2} label="Processadas" value={doneCount} accent="teal" />
          <StatCard icon={Clock} label="Pendentes" value={pendingCount} accent="amber" />
          <StatCard icon={AlertCircle} label="Com erro" value={errorCount} accent="red" />
        </div>

        {/* ── Main grid: Upload + File lists ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ── Left: Upload area ── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Upload card com tab switcher */}
            <div className="rounded-xl bg-white border border-border overflow-hidden">

              {/* Header com tabs */}
              <div className="px-4 pt-3 pb-0 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[13px] font-semibold text-foreground flex items-center gap-2">
                    <FileUp className="h-4 w-4 text-secondary" aria-hidden />
                    Upload de arquivos
                  </h2>
                </div>
                {/* Tabs */}
                <div className="flex gap-1 -mb-px">
                  <button
                    type="button"
                    onClick={() => setUploadTab('xlsx')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
                      uploadTab === 'xlsx'
                        ? 'border-secondary text-secondary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                    Planilha XLSX
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTab('xml')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
                      uploadTab === 'xml'
                        ? 'border-secondary text-secondary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <FileCode2 className="h-3.5 w-3.5" aria-hidden />
                    XML NF-e
                  </button>
                </div>
              </div>

              {/* Drop zone XLSX */}
              {uploadTab === 'xlsx' && (
                <>
                  <div
                    className={`m-4 rounded-lg border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-200 ${
                      dragOver
                        ? 'border-secondary bg-secondary/5 scale-[1.01]'
                        : 'border-border hover:border-secondary/40 hover:bg-secondary/[0.02]'
                    }`}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragOver(false) }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation(); setDragOver(false)
                      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xlsx'))
                      files.length > 0 ? (addFiles(files), setErr(null)) : setErr('Apenas arquivos .xlsx sao aceitos.')
                    }}
                  >
                    <div className="space-y-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mx-auto transition-colors ${
                        dragOver ? 'bg-secondary/15' : 'bg-secondary/8'
                      }`}>
                        <Upload className={`h-6 w-6 transition-colors ${dragOver ? 'text-secondary' : 'text-secondary/70'}`} aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {dragOver ? 'Solte para adicionar' : 'Arraste seus arquivos aqui'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Aceita planilhas .xlsx com coluna NCM
                        </p>
                      </div>
                      <div className="flex items-center gap-3 justify-center">
                        <div className="h-px flex-1 max-w-[60px] bg-border" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">ou</span>
                        <div className="h-px flex-1 max-w-[60px] bg-border" />
                      </div>
                      <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="cursor-pointer">
                        <FileSpreadsheet className="h-4 w-4" aria-hidden /> Selecionar arquivo
                      </Button>
                      <input ref={fileRef} type="file" accept=".xlsx" multiple onChange={e => {
                        const files = e.target.files
                        if (files?.length) { addFiles(Array.from(files)); setErr(null) }
                        if (fileRef.current) fileRef.current.value = ''
                      }} className="hidden" />
                    </div>
                  </div>
                  {err && (
                    <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {err}
                    </div>
                  )}
                </>
              )}

              {/* Drop zone XML */}
              {uploadTab === 'xml' && (
                <>
                  <div
                    className={`m-4 rounded-lg border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-200 ${
                      xmlDragOver
                        ? 'border-secondary bg-secondary/5 scale-[1.01]'
                        : 'border-border hover:border-secondary/40 hover:bg-secondary/[0.02]'
                    }`}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setXmlDragOver(true) }}
                    onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setXmlDragOver(true) }}
                    onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setXmlDragOver(false) }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation(); setXmlDragOver(false)
                      const files = Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith('.xml'))
                      files.length > 0 ? (xml.addFiles(files), setXmlErr(null)) : setXmlErr('Apenas arquivos .xml sao aceitos.')
                    }}
                  >
                    <div className="space-y-3">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl mx-auto transition-colors ${
                        xmlDragOver ? 'bg-secondary/15' : 'bg-secondary/8'
                      }`}>
                        <FileCode2 className={`h-6 w-6 transition-colors ${xmlDragOver ? 'text-secondary' : 'text-secondary/70'}`} aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {xmlDragOver ? 'Solte para adicionar' : 'Arraste o arquivo XML aqui'}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Aceita NF-e .xml — extrai itens automaticamente
                        </p>
                      </div>
                      <div className="flex items-center gap-3 justify-center">
                        <div className="h-px flex-1 max-w-[60px] bg-border" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">ou</span>
                        <div className="h-px flex-1 max-w-[60px] bg-border" />
                      </div>
                      <Button type="button" variant="outline" onClick={() => xmlFileRef.current?.click()} className="cursor-pointer">
                        <FileCode2 className="h-4 w-4" aria-hidden /> Selecionar XML
                      </Button>
                      <input ref={xmlFileRef} type="file" accept=".xml" multiple onChange={e => {
                        const files = e.target.files
                        if (files?.length) { xml.addFiles(Array.from(files)); setXmlErr(null) }
                        if (xmlFileRef.current) xmlFileRef.current.value = ''
                      }} className="hidden" />
                    </div>
                  </div>
                  {xmlErr && (
                    <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {xmlErr}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Template download — collapsible */}
            <CollapsibleTemplates />

            {/* Quick help — collapsible */}
            <CollapsibleHelp tab={uploadTab} />
          </div>

          {/* ── Right: File lists stacked ── */}
          <div className="lg:col-span-8 space-y-5">

            {/* ── Card: Planilhas XLSX ── */}
            <div className="rounded-xl bg-white border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-[#13293D] to-[#1a3a50] flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-white/70" aria-hidden />
                  <h2 className="text-[13px] font-semibold text-white">Planilhas XLSX</h2>
                  {items.length > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/15 px-1.5 text-[10px] font-bold text-white tabular-nums">
                      {items.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasPending && !isProcessing && items.length > 1 && (
                    <Button type="button" size="sm" onClick={() => void processAll()} className="cursor-pointer bg-white text-[#13293D] hover:bg-white/90">
                      <Play className="h-3 w-3" aria-hidden /> Processar todas
                    </Button>
                  )}
                </div>
              </div>
              <BatchProgress items={items} />
              {items.length === 0 ? (
                <EmptyFileList />
              ) : (
                <div className="divide-y divide-border">
                  {items.map(item => (
                    <FileRow
                      key={item.id}
                      item={item}
                      onRemove={() => removeItem(item.id)}
                      onProcess={() => void processItem(item.id)}
                    />
                  ))}
                </div>
              )}
              {items.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-background-muted/30 flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {doneCount > 0 && `${doneCount} de ${totalCount} concluida(s)`}
                    {doneCount === 0 && pendingCount > 0 && `${pendingCount} planilha(s) aguardando processamento`}
                    {doneCount === 0 && pendingCount === 0 && errorCount > 0 && `${errorCount} planilha(s) com erro`}
                  </p>
                  {doneCount > 0 && doneCount === totalCount && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      <span className="text-[11px] font-semibold">Lote completo</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Card: Arquivos XML NF-e ── */}
            <div className="rounded-xl bg-white border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-[#1a4a3a] to-[#1f5a45] flex items-center justify-between rounded-t-xl">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-white/70" aria-hidden />
                  <h2 className="text-[13px] font-semibold text-white">XML NF-e</h2>
                  {xml.items.length > 0 && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/15 px-1.5 text-[10px] font-bold text-white tabular-nums">
                      {xml.items.length}
                    </span>
                  )}
                  <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70 font-medium">
                    Gera planilha tributária
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {xmlHasPending && !xmlIsProcessing && xml.items.length > 1 && (
                    <Button type="button" size="sm" onClick={() => void xml.processAll()} className="cursor-pointer bg-white text-[#1a4a3a] hover:bg-white/90">
                      <Play className="h-3 w-3" aria-hidden /> Processar todas
                    </Button>
                  )}
                </div>
              </div>
              <BatchProgress items={xml.items} />
              {xml.items.length === 0 ? (
                <EmptyXmlList />
              ) : (
                <div className="divide-y divide-border">
                  {xml.items.map(item => (
                    <FileRow
                      key={item.id}
                      item={item}
                      icon={FileCode2}
                      onRemove={() => xml.removeItem(item.id)}
                      onProcess={() => void xml.processItem(item.id)}
                    />
                  ))}
                </div>
              )}
              {xml.items.length > 0 && (
                <div className="px-4 py-3 border-t border-border bg-background-muted/30 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {xmlDoneCount > 0 && `${xmlDoneCount} de ${xmlTotalCount} concluido(s)`}
                    {xmlDoneCount === 0 && xmlPendingCount > 0 && `${xmlPendingCount} arquivo(s) aguardando processamento`}
                    {xmlDoneCount === 0 && xmlPendingCount === 0 && xmlErrorCount > 0 && `${xmlErrorCount} arquivo(s) com erro`}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {xmlDoneCount > 0 && xmlDoneCount === xmlTotalCount && (
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        <span className="text-[11px] font-semibold">Lote completo</span>
                      </div>
                    )}
                    {xml.items.length > 1 && (
                      <button
                        onClick={() => void xml.downloadMerged()}
                        disabled={xml.merging || xmlIsProcessing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        {xml.merging
                          ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden />Gerando...</>
                          : <><FileDown className="h-3 w-3" aria-hidden />Download unificado</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white py-3 px-4 lg:px-6 text-[11px] text-muted-foreground">
        &copy; {new Date().getFullYear()} Seven Sistemas de Automacoes. Todos os direitos reservados.
      </footer>
    </div>
  )
}
