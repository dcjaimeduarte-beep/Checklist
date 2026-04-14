import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'
import type { ConfrontResultDto } from '@/types/confront'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface ConfrontState {
  sessionId: string | null
  result: ConfrontResultDto | null
  status: UploadStatus
  progress: number
  error: string | null
  setResult: (r: ConfrontResultDto) => void
  setStatus: (s: UploadStatus) => void
  setProgress: (p: number) => void
  setError: (e: string | null) => void
  reset: () => void
}

const ConfrontContext = createContext<ConfrontState>({
  sessionId: null,
  result: null,
  status: 'idle',
  progress: 0,
  error: null,
  setResult: () => {},
  setStatus: () => {},
  setProgress: () => {},
  setError: () => {},
  reset: () => {},
})

const SESSION_KEY = 'analisesped:session'

function loadSession(): { sessionId: string; result: ConfrontResultDto } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function ConfrontProvider({ children }: { children: ReactNode }) {
  const saved = loadSession()
  const [sessionId, setSessionId] = useState<string | null>(saved?.sessionId ?? null)
  const [result, setResultState] = useState<ConfrontResultDto | null>(saved?.result ?? null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const setResult = useCallback((r: ConfrontResultDto) => {
    setResultState(r)
    setSessionId(r.sessionId)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId: r.sessionId, result: r }))
  }, [])

  const reset = useCallback(() => {
    setResultState(null)
    setSessionId(null)
    setStatus('idle')
    setProgress(0)
    setError(null)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  return (
    <ConfrontContext.Provider
      value={{ sessionId, result, status, progress, error, setResult, setStatus, setProgress, setError, reset }}
    >
      {children}
    </ConfrontContext.Provider>
  )
}

export function useConfront() {
  return useContext(ConfrontContext)
}
