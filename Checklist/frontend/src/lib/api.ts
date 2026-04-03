/**
 * Base da API. Em dev, o Vite faz proxy de `/api` → backend (cookie HttpOnly na mesma origem).
 */
import type { TaxAnalysisView } from '@/types/tax-analysis'

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'

export type AnalyzeRequest = {
  ncm?: string
  regime?: string
  year?: string
  query?: string
}

export type AnalyzeResponse = {
  query: string
  cached: boolean
  /** Montado no servidor — o frontend só exibe */
  view: TaxAnalysisView
}

const credentialsInit: RequestCredentials = 'include'

export async function loginRequest(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: credentialsInit,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || 'Credenciais inválidas')
  }
}

export async function logoutRequest(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: credentialsInit,
  })
}

export async function sessionMeRequest(): Promise<{ userId: string } | null> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    credentials: credentialsInit,
  })
  if (res.status === 401) return null
  if (!res.ok) return null
  return res.json() as Promise<{ userId: string }>
}

export async function analyzeRequest(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/consultation/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    credentials: credentialsInit,
  })
  if (res.status === 401) {
    throw new Error('Sessão expirada ou inválida. Volte a entrar.')
  }
  if (!res.ok) {
    let msg = 'Não foi possível concluir a análise.'
    try {
      const body = await res.json()
      if (body?.message) {
        const m = Array.isArray(body.message) ? body.message.join('; ') : body.message
        msg = m
      }
    } catch {
      const t = await res.text().catch(() => '')
      if (t) msg = t
    }
    throw new Error(msg)
  }
  return res.json() as Promise<AnalyzeResponse>
}

export async function batchProcessRequest(file: File): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000) // 2 min timeout

  try {
    const res = await fetch(`${API_BASE}/batch/process`, {
      method: 'POST',
      body: formData,
      credentials: credentialsInit,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.status === 401) {
      throw new Error('Sessão expirada ou inválida. Volte a entrar.')
    }
    if (!res.ok) {
      let msg = 'Erro ao processar planilha.'
      try { msg = await res.text() || msg } catch { /* ignore */ }
      throw new Error(msg)
    }
    return await res.blob()
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Tempo limite excedido (2 min). Tente uma planilha menor.')
    }
    throw e
  }
}

export async function batchProcessXmlRequest(file: File): Promise<Blob> {
  const formData = new FormData()
  formData.append('file', file)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  try {
    const res = await fetch(`${API_BASE}/batch/process-xml`, {
      method: 'POST',
      body: formData,
      credentials: credentialsInit,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.status === 401) {
      throw new Error('Sessão expirada ou inválida. Volte a entrar.')
    }
    if (!res.ok) {
      let msg = 'Erro ao processar XML.'
      try { msg = await res.text() || msg } catch { /* ignore */ }
      throw new Error(msg)
    }
    return await res.blob()
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Tempo limite excedido (2 min). Tente um arquivo menor.')
    }
    throw e
  }
}

export async function batchMergeXmlRequest(files: File[]): Promise<Blob> {
  const formData = new FormData()
  for (const file of files) formData.append('files', file)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 300_000) // 5 min para múltiplos arquivos

  try {
    const res = await fetch(`${API_BASE}/batch/merge-xml`, {
      method: 'POST',
      body: formData,
      credentials: credentialsInit,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.status === 401) throw new Error('Sessão expirada ou inválida. Volte a entrar.')
    if (!res.ok) {
      let msg = 'Erro ao consolidar XMLs.'
      try { msg = await res.text() || msg } catch { /* ignore */ }
      throw new Error(msg)
    }
    return await res.blob()
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Tempo limite excedido (5 min). Tente com menos arquivos.')
    }
    throw e
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'omit' })
    return res.ok
  } catch {
    return false
  }
}
