import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { batchProcessXmlRequest, batchMergeXmlRequest } from '@/lib/api'
import {
  saveBatchItem,
  removeBatchItem as removeFromIDB,
  loadBatchItemsByType,
  type PersistedBatchItem,
} from '@/lib/idb-store'

export type XmlBatchItemStatus = 'pending' | 'processing' | 'done' | 'error'

export type XmlBatchItem = {
  id: string
  fileName: string
  fileSize: number
  fileBlob: Blob
  status: XmlBatchItemStatus
  downloadUrl?: string
  downloadName?: string
  error?: string
  startedAt?: number
}

type XmlBatchContextValue = {
  items: XmlBatchItem[]
  ready: boolean
  merging: boolean
  addFiles: (files: File[]) => void
  removeItem: (id: string) => void
  processItem: (id: string) => Promise<void>
  processAll: () => Promise<void>
  downloadMerged: () => Promise<void>
}

const XmlBatchContext = createContext<XmlBatchContextValue | null>(null)

export function useXmlBatch() {
  const ctx = useContext(XmlBatchContext)
  if (!ctx) throw new Error('useXmlBatch must be used within XmlBatchProvider')
  return ctx
}

let xmlNextId = Date.now() + 2_000_000

export function XmlBatchProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<XmlBatchItem[]>([])
  const [ready, setReady] = useState(false)
  const [merging, setMerging] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  /* ── Restore from IndexedDB on mount ── */
  useEffect(() => {
    loadBatchItemsByType('xml')
      .then((persisted) => {
        const restored: XmlBatchItem[] = persisted.map((p) => {
          const item: XmlBatchItem = {
            id: p.id,
            fileName: p.fileName,
            fileSize: p.fileSize,
            fileBlob: p.fileBlob,
            status: p.status === 'processing' ? 'pending' : p.status,
            error: p.error,
          }
          if (p.status === 'done' && p.resultBlob) {
            item.downloadUrl = URL.createObjectURL(p.resultBlob)
            item.downloadName = p.resultName
            item.status = 'done'
          }
          return item
        })
        setItems(restored)
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [])

  /* ── Persist a single item to IDB ── */
  const persistToIDB = useCallback(async (item: XmlBatchItem, resultBlob?: Blob) => {
    const p: PersistedBatchItem = {
      id: item.id,
      fileName: item.fileName,
      fileSize: item.fileSize,
      fileBlob: item.fileBlob,
      status: item.status,
      error: item.error,
      resultBlob,
      resultName: item.downloadName,
      type: 'xml',
    }
    await saveBatchItem(p).catch(() => {})
  }, [])

  const addFiles = useCallback((files: File[]) => {
    const newItems: XmlBatchItem[] = files
      .filter((f) => f.name.toLowerCase().endsWith('.xml'))
      .map((f) => ({
        id: String(xmlNextId++),
        fileName: f.name,
        fileSize: f.size,
        fileBlob: f as Blob,
        status: 'pending' as const,
      }))

    setItems((prev) => [...prev, ...newItems])
    for (const item of newItems) persistToIDB(item)
  }, [persistToIDB])

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.downloadUrl) URL.revokeObjectURL(item.downloadUrl)
      return prev.filter((i) => i.id !== id)
    })
    removeFromIDB(id).catch(() => {})
  }, [])

  const processItem = useCallback(async (id: string) => {
    const current = itemsRef.current.find((i) => i.id === id)
    if (!current) return

    const blob = current.fileBlob
    const name = current.fileName

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'processing' as const, error: undefined, startedAt: Date.now() } : i)),
    )

    const fileObj = new File([blob], name, { type: 'text/xml' })

    try {
      const resultBlob = await batchProcessXmlRequest(fileObj)
      const url = URL.createObjectURL(resultBlob)
      const downloadName = name.replace(/\.xml$/i, '_analisado.xlsx')

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'done' as const, downloadUrl: url, downloadName } : i,
        ),
      )

      const doneItem: XmlBatchItem = { ...current, status: 'done', downloadUrl: url, downloadName }
      persistToIDB(doneItem, resultBlob)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar.'
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'error' as const, error: msg } : i)),
      )
      persistToIDB({ ...current, status: 'error', error: msg })
    }
  }, [persistToIDB])

  const processAll = useCallback(async () => {
    const pending = itemsRef.current.filter((i) => i.status === 'pending').map((i) => i.id)
    for (const id of pending) await processItem(id)
  }, [processItem])

  const downloadMerged = useCallback(async () => {
    const all = itemsRef.current
    if (all.length === 0) return
    setMerging(true)
    try {
      const files = all.map((item) => new File([item.fileBlob], item.fileName, { type: 'text/xml' }))
      const blob = await batchMergeXmlRequest(files)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nfe_consolidado.xlsx'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } finally {
      setMerging(false)
    }
  }, [])

  return (
    <XmlBatchContext.Provider value={{ items, ready, merging, addFiles, removeItem, processItem, processAll, downloadMerged }}>
      {children}
    </XmlBatchContext.Provider>
  )
}
