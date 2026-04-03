import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AnalyzeResponse } from '@/lib/api'

const STORAGE_KEY = 'seven_consult_state'

type ConsultContextValue = {
  ncm: string
  setNcm: (v: string) => void
  regime: string
  setRegime: (v: string) => void
  year: string
  setYear: (v: string) => void
  result: AnalyzeResponse | null
  setResult: (v: AnalyzeResponse | null) => void
}

const ConsultContext = createContext<ConsultContextValue | null>(null)

export function useConsult() {
  const ctx = useContext(ConsultContext)
  if (!ctx) throw new Error('useConsult must be used within ConsultProvider')
  return ctx
}

function loadState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return null
}

export function ConsultProvider({ children }: { children: ReactNode }) {
  const saved = loadState()
  const [ncm, setNcm] = useState(saved?.ncm ?? '')
  const [regime, setRegime] = useState(saved?.regime ?? '')
  const [year, setYear] = useState(saved?.year ?? '2026')
  const [result, setResult] = useState<AnalyzeResponse | null>(saved?.result ?? null)

  const persist = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ncm, regime, year, result }))
    } catch { /* quota exceeded */ }
  }, [ncm, regime, year, result])

  useEffect(() => { persist() }, [persist])

  return (
    <ConsultContext.Provider value={{ ncm, setNcm, regime, setRegime, year, setYear, result, setResult }}>
      {children}
    </ConsultContext.Provider>
  )
}
