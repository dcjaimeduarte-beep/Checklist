import { useCallback, useRef, useState } from 'react'
import { FileText, FolderOpen, Upload, X, AlertCircle, RefreshCw } from 'lucide-react'

import { useConfront } from '@/confront/ConfrontContext'
import { usePage } from '@/App'
import { confrontRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function UploadPage() {
  const { setResult, setStatus, setProgress, setError, status, progress, error } = useConfront()
  const { setPage } = usePage()

  const [spedFile, setSpedFile] = useState<File | null>(null)
  const [xmlFiles, setXmlFiles] = useState<File[]>([])
  const [spedDragOver, setSpedDragOver] = useState(false)
  const [xmlDragOver, setXmlDragOver] = useState(false)

  const spedInputRef = useRef<HTMLInputElement>(null)
  const xmlInputRef = useRef<HTMLInputElement>(null)
  const xmlFolderRef = useRef<HTMLInputElement>(null)

  const isRunning = status === 'uploading' || status === 'processing'

  // ── SPED ──────────────────────────────────────────────────────────

  const handleSpedDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setSpedDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setSpedFile(file)
  }, [])

  // ── XMLs ──────────────────────────────────────────────────────────

  const handleXmlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) =>
      f.name.toLowerCase().endsWith('.xml'),
    )
    setXmlFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size))
      return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))]
    })
    e.target.value = ''
  }, [])

  const handleXmlDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setXmlDragOver(false)
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.xml'),
    )
    if (files.length) {
      setXmlFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name + f.size))
        return [...prev, ...files.filter((f) => !existing.has(f.name + f.size))]
      })
    }
  }, [])

  const removeXml = (index: number) => {
    setXmlFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Confrontar ────────────────────────────────────────────────────

  async function handleConfront() {
    if (!spedFile || xmlFiles.length === 0) return

    setStatus('uploading')
    setProgress(0)
    setError(null)

    try {
      const result = await confrontRequest(spedFile, xmlFiles, (pct) => {
        setProgress(pct)
        if (pct >= 90) setStatus('processing')
      })
      setResult(result)
      setStatus('done')
      setPage('resultados')
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }

  const canRun = spedFile !== null && xmlFiles.length > 0 && !isRunning

  return (
    <div className="flex min-h-screen flex-col bg-backgroundMuted">
      {/* Cabeçalho */}
      <header className="border-b border-border bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">AnaliseSped</h1>
            <p className="text-xs text-muted-foreground">Confronto SPED Fiscal × XMLs de NF-e/CT-e</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-foreground">Novo Confronto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie o arquivo SPED Fiscal e selecione a pasta com os XMLs para comparar.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── SPED ── */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Arquivo SPED Fiscal</h3>
                <p className="text-xs text-muted-foreground">EFD ICMS/IPI · formato .txt</p>
              </div>
            </div>

            {spedFile ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-800">{spedFile.name}</p>
                    <p className="text-xs text-green-600">{(spedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSpedFile(null)}
                  className="cursor-pointer rounded p-1 hover:bg-green-100 text-green-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setSpedDragOver(true) }}
                onDragLeave={() => setSpedDragOver(false)}
                onDrop={handleSpedDrop}
                onClick={() => spedInputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
                  spedDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-backgroundMuted',
                )}
              >
                <Upload className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Arraste o SPED aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">ou clique para selecionar</p>
              </div>
            )}

            <input
              ref={spedInputRef}
              type="file"
              accept=".txt,.TXT"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setSpedFile(f)
                e.target.value = ''
              }}
            />
          </section>

          {/* ── XMLs ── */}
          <section className="rounded-xl border border-border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
                <FolderOpen className="h-4 w-4 text-secondary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Pasta de XMLs</h3>
                <p className="text-xs text-muted-foreground">NF-e · NFC-e · CT-e</p>
              </div>
            </div>

            <div className="mb-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs cursor-pointer"
                onClick={() => xmlFolderRef.current?.click()}
              >
                <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
                Selecionar pasta
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs cursor-pointer"
                onClick={() => xmlInputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Selecionar arquivos
              </Button>
            </div>

            <input
              ref={xmlFolderRef}
              type="file"
              accept=".xml,.XML"
              multiple
              // @ts-expect-error webkitdirectory não está no @types/react
              webkitdirectory=""
              className="hidden"
              onChange={handleXmlChange}
            />
            <input
              ref={xmlInputRef}
              type="file"
              accept=".xml,.XML"
              multiple
              className="hidden"
              onChange={handleXmlChange}
            />

            {xmlFiles.length > 0 ? (
              <div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setXmlDragOver(true) }}
                  onDragLeave={() => setXmlDragOver(false)}
                  onDrop={handleXmlDrop}
                  className={cn(
                    'mb-2 rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground',
                    xmlDragOver ? 'border-secondary bg-secondary/5' : 'border-border',
                  )}
                >
                  Arraste mais XMLs aqui
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  {xmlFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 last:border-0"
                    >
                      <p className="truncate text-xs text-foreground" title={f.name}>{f.name}</p>
                      <button
                        type="button"
                        onClick={() => removeXml(i)}
                        className="ml-2 cursor-pointer shrink-0 rounded p-0.5 hover:bg-backgroundMuted text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-right text-xs font-medium text-primary">
                  {xmlFiles.length} arquivo{xmlFiles.length !== 1 ? 's' : ''} selecionado{xmlFiles.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setXmlDragOver(true) }}
                onDragLeave={() => setXmlDragOver(false)}
                onDrop={handleXmlDrop}
                onClick={() => xmlInputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors',
                  xmlDragOver
                    ? 'border-secondary bg-secondary/5'
                    : 'border-border hover:border-secondary/50 hover:bg-backgroundMuted',
                )}
              >
                <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Arraste os XMLs aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">ou clique para selecionar</p>
              </div>
            )}
          </section>
        </div>

        {/* ── Progresso / Erro ── */}
        {isRunning && (
          <div className="mt-6 rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {status === 'uploading' ? 'Enviando arquivos…' : 'Processando confronto…'}
              </span>
              <span className="text-primary font-semibold">{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-backgroundMuted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Aguarde — arquivos SPED podem levar alguns instantes para processar.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-medium text-red-700">Erro ao processar</p>
              <p className="mt-0.5 text-xs text-red-600">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => { setStatus('idle'); setError(null) }}
              className="ml-auto cursor-pointer rounded p-1 hover:bg-red-100 text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ── Botão confrontar ── */}
        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            size="lg"
            disabled={!canRun}
            onClick={handleConfront}
            className="cursor-pointer gap-2 px-8"
          >
            <RefreshCw className={cn('h-4 w-4', isRunning && 'animate-spin')} />
            {isRunning ? 'Processando…' : 'Executar Confronto'}
          </Button>
        </div>

        {/* ── Instruções ── */}
        {!isRunning && status === 'idle' && (
          <div className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Como funciona</h3>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                <span>Selecione o arquivo <strong className="text-foreground">SPED Fiscal (EFD ICMS/IPI)</strong> no formato .txt.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                <span>Selecione a <strong className="text-foreground">pasta com os XMLs</strong> de NF-e, NFC-e ou CT-e do mesmo período.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                <span>Clique em <strong className="text-foreground">Executar Confronto</strong> — o sistema identifica divergências automaticamente.</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
                <span>Baixe o relatório em <strong className="text-foreground">Excel ou PDF</strong> e envie por e-mail para registrar.</span>
              </li>
            </ol>
          </div>
        )}
      </main>
    </div>
  )
}
