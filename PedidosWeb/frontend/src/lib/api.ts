import type {
  PedidoSummary,
  PedidoDetalhe,
  ClienteErp,
  ProdutoErp,
  CondicaoPagamento,
  CriarPedidoDto,
} from '@/types/pedido'

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'
const creds: RequestCredentials = 'include'

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: creds,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// ── Auth ─────────────────────────────────────────────────────────

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

export async function sessionMeRequest(): Promise<{ userId: string; nome?: string } | null> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: creds })
  if (!res.ok) return null
  return res.json() as Promise<{ userId: string; nome?: string }>
}

// ── Pedidos ──────────────────────────────────────────────────────

export async function listarPedidos(params?: {
  status?: string
  page?: number
  limit?: number
}): Promise<PedidoSummary[]> {
  const q = new URLSearchParams()
  if (params?.status) q.set('status', params.status)
  q.set('page', String(params?.page ?? 1))
  q.set('limit', String(params?.limit ?? 30))
  return apiFetch<PedidoSummary[]>(`/pedidos?${q}`)
}

export async function obterPedido(id: number): Promise<PedidoDetalhe> {
  return apiFetch<PedidoDetalhe>(`/pedidos/${id}`)
}

export async function criarPedido(dto: CriarPedidoDto): Promise<PedidoDetalhe> {
  return apiFetch<PedidoDetalhe>('/pedidos', {
    method: 'POST',
    body: JSON.stringify(dto),
  })
}

export async function transmitirPedido(id: number): Promise<PedidoDetalhe> {
  return apiFetch<PedidoDetalhe>(`/pedidos/${id}/transmitir`, { method: 'POST' })
}

export async function finalizarPedido(id: number): Promise<PedidoDetalhe> {
  return apiFetch<PedidoDetalhe>(`/pedidos/${id}/finalizar`, { method: 'POST' })
}

export async function cancelarPedido(id: number, motivo?: string): Promise<void> {
  await apiFetch(`/pedidos/${id}/cancelar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  })
}

// ── Clientes (leitura Firebird) ───────────────────────────────────

export async function buscarClientes(q: string): Promise<ClienteErp[]> {
  return apiFetch<ClienteErp[]>(`/clientes?q=${encodeURIComponent(q)}`)
}

export async function obterClientePadrao(): Promise<ClienteErp | null> {
  return apiFetch<ClienteErp | null>('/clientes/padrao')
}

// ── Produtos (leitura Firebird) ───────────────────────────────────

export async function buscarProdutos(q: string): Promise<ProdutoErp[]> {
  return apiFetch<ProdutoErp[]>(`/produtos?q=${encodeURIComponent(q)}`)
}

// ── Condições de pagamento (leitura Firebird) ─────────────────────

export async function listarCondicoesPagamento(): Promise<CondicaoPagamento[]> {
  return apiFetch<CondicaoPagamento[]>('/condicoes-pagamento')
}

// ── Empresa ──────────────────────────────────────────────────────

export interface EmpresaInfo {
  nmFantasia: string
  nmRazaoSocial: string
  dsCnpj: string
  dsInscEstadual: string
  dsEndereco: string
  dsNumero: string
  dsMunicipio: string
  dsUf: string
  dsTelefone: string
  dsEmail?: string
}

export async function obterEmpresa(): Promise<EmpresaInfo> {
  return apiFetch<EmpresaInfo>('/empresa')
}

// ── Health ────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'omit' })
    return res.ok
  } catch {
    return false
  }
}
