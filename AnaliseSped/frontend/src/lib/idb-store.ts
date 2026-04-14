/**
 * Simple IndexedDB wrapper for persisting batch files (input + output blobs).
 * Survives F5 / page refresh.
 */

const DB_NAME = 'seven_batch'
const DB_VERSION = 1
const STORE_NAME = 'files'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export type PersistedBatchItem = {
  id: string
  fileName: string
  fileSize: number
  fileBlob: Blob
  status: 'pending' | 'processing' | 'done' | 'error'
  resultBlob?: Blob
  resultName?: string
  error?: string
  /** 'xlsx' (padrão) ou 'xml' — usado para separar os dois contextos */
  type?: 'xlsx' | 'xml'
}

export async function saveBatchItem(item: PersistedBatchItem): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function removeBatchItem(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadAllBatchItems(): Promise<PersistedBatchItem[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadBatchItemsByType(type: 'xlsx' | 'xml'): Promise<PersistedBatchItem[]> {
  const all = await loadAllBatchItems()
  return all.filter((item) => (item.type ?? 'xlsx') === type)
}

export async function clearAllBatchItems(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
