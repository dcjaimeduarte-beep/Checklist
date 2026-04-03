import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { batchProcessRequest } from '@/lib/api'
import {
  saveBatchItem,
  removeBatchItem as removeFromIDB,
  loadBatchItemsByType,
  type PersistedBatchItem,
} from '@/lib/idb-store'

export type BatchItemStatus = 'pending' | 'processing' | 'done' | 'error'

export type BatchItem = {
  id: string
  fileName: string
  fileSize: number
  fileBlob: Blob
  status: BatchItemStatus
  downloadUrl?: string
  downloadName?: string
  error?: string
  startedAt?: number
}

type BatchContextValue = {
  items: BatchItem[]
  ready: boolean
  addFiles: (files: File[]) => void
  removeItem: (id: string) => void
  processItem: (id: string) => Promise<void>
  processAll: () => Promise<void>
}

const BatchContext = createContext<BatchContextValue | null>(null)

export function useBatch() {
  const ctx = useContext(BatchContext)
  if (!ctx) throw new Error('useBatch must be used within BatchProvider')
  return ctx
}

let nextId = Date.now()

export function BatchProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [ready, setReady] = useState(false)
  const itemsRef = useRef(items)
  itemsRef.current = items

  /* ── Restore from IndexedDB on mount ── */
  useEffect(() => {
    loadBatchItemsByType('xlsx')
      .then((persisted) => {
        const restored: BatchItem[] = persisted.map((p) => {
          const item: BatchItem = {
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
  const persistToIDB = useCallback(async (item: BatchItem, resultBlob?: Blob) => {
    const p: PersistedBatchItem = {
      id: item.id,
      fileName: item.fileName,
      fileSize: item.fileSize,
      fileBlob: item.fileBlob,
      status: item.status,
      error: item.error,
      resultBlob,
      resultName: item.downloadName,
      type: 'xlsx',
    }
    await saveBatchItem(p).catch(() => {})
  }, [])

  const addFiles = useCallback((files: File[]) => {
    const newItems: BatchItem[] = files
      .filter((f) => f.name.endsWith('.xlsx'))
      .map((f) => ({
        id: String(nextId++),
        fileName: f.name,
        fileSize: f.size,
        fileBlob: f as Blob,
        status: 'pending' as const,
      }))

    setItems((prev) => [...prev, ...newItems])

    // Persist in background (don't block UI)
    for (const item of newItems) {
      persistToIDB(item)
    }
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
    // Read the item data SYNCHRONOUSLY from the ref before any async work
    const current = itemsRef.current.find((i) => i.id === id)
    if (!current) return

    const blob = current.fileBlob
    const name = current.fileName

    // Mark as processing
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: 'processing' as const, error: undefined, startedAt: Date.now() } : i)),
    )

    // Create File object for upload
    const fileObj = new File([blob], name, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    try {
      const resultBlob = await batchProcessRequest(fileObj)
      const url = URL.createObjectURL(resultBlob)
      const downloadName = name.replace(/\.xlsx$/i, '_analisado.xlsx')

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, status: 'done' as const, downloadUrl: url, downloadName } : i,
        ),
      )

      // Persist completed item with result
      const doneItem: BatchItem = { ...current, status: 'done', downloadUrl: url, downloadName }
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
    for (const id of pending) {
      await processItem(id)
    }
  }, [processItem])

  return (
    <BatchContext.Provider value={{ items, ready, addFiles, removeItem, processItem, processAll }}>
      {children}
    </BatchContext.Provider>
  )
}
