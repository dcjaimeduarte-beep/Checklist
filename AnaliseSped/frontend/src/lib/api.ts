import type { ConfrontResultDto, ConfrontSessionSummary } from '@/types/confront'

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'
const creds: RequestCredentials = 'include'

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginRequest(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: creds,
  })
  if (!res.ok) throw new Error((await res.text()) || 'Credenciais inválidas')
}

export async function logoutRequest(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: creds })
}

export async function sessionMeRequest(): Promise<{ userId: string } | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: creds })
  if (!res.ok) return null
  return res.json() as Promise<{ userId: string }>
}

// ── Confronto ────────────────────────────────────────────────────────────────

export async function confrontRequest(
  spedFile: File,
  xmlFiles: File[],
  onProgress?: (pct: number) => void,
): Promise<ConfrontResultDto> {
  const formData = new FormData()
  formData.append('sped', spedFile)
  for (const xml of xmlFiles) formData.append('xmls', xml)

  // XHR para poder reportar progresso de upload
  return new Promise<ConfrontResultDto>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.withCredentials = true

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 90))
      }
    })

    xhr.addEventListener('load', () => {
      if (onProgress) onProgress(100)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as ConfrontResultDto)
        } catch {
          reject(new Error('Resposta inválida do servidor'))
        }
      } else {
        let msg = `Erro ${xhr.status}`
        try { msg = JSON.parse(xhr.responseText)?.message ?? msg } catch { /* ignore */ }
        reject(new Error(msg))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Falha de rede')))
    xhr.addEventListener('timeout', () => reject(new Error('Tempo limite excedido')))
    xhr.timeout = 600_000 // 10 min

    xhr.open('POST', `${API_BASE}/confront/run`)
    xhr.send(formData)
  })
}

export async function getConfrontResult(sessionId: string): Promise<ConfrontResultDto> {
  const res = await fetch(`${API_BASE}/confront/${sessionId}`, { credentials: creds })
  if (!res.ok) throw new Error(`Sessão não encontrada: ${sessionId}`)
  return res.json() as Promise<ConfrontResultDto>
}

export async function listSessions(page = 1): Promise<ConfrontSessionSummary[]> {
  const res = await fetch(`${API_BASE}/confront/sessions?page=${page}&limit=20`, { credentials: creds })
  if (!res.ok) return []
  return res.json() as Promise<ConfrontSessionSummary[]>
}

export async function downloadExcel(sessionId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/confront/${sessionId}/excel`, { credentials: creds })
  if (!res.ok) throw new Error('Erro ao gerar Excel')
  return res.blob()
}

export async function downloadPdf(sessionId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/confront/${sessionId}/pdf`, { credentials: creds })
  if (!res.ok) throw new Error('Erro ao gerar PDF')
  return res.blob()
}

export async function sendEmailReport(
  sessionId: string,
  to: string,
  message?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/confront/${sessionId}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
    credentials: creds,
  })
  if (!res.ok) throw new Error('Erro ao enviar e-mail')
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'omit' })
    return res.ok
  } catch {
    return false
  }
}
