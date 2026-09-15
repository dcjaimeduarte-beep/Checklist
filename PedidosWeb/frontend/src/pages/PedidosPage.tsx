import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, RefreshCw, Search, ShoppingCart } from 'lucide-react'
import { listarPedidos } from '@/lib/api'
import { fmtMoeda, fmtData, fmtCpfCnpj } from '@/lib/fmt'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PedidoSummary, PedidoStatus } from '@/types/pedido'

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'TRANSMITINDO', label: 'Transmitindo' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'ERRO', label: 'Erro ERP' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

function hoje(): string {
  return new Date().toISOString().split('T')[0]
}

const STORAGE_KEY = 'pedidos_filtros'

function lerFiltros() {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY)
    if (s) return JSON.parse(s) as { dtDe: string; dtAte: string; status: string; busca: string }
  } catch { /* ignore */ }
  return { dtDe: hoje(), dtAte: hoje(), status: '', busca: '' }
}

function salvarFiltros(f: { dtDe: string; dtAte: string; status: string; busca: string }) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f))
}

export function PedidosPage() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState<PedidoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const inicial = lerFiltros()
  const [filtroStatus, setFiltroStatus] = useState(inicial.status)
  const [busca, setBusca] = useState(inicial.busca)
  const [dtDe, setDtDe] = useState(inicial.dtDe)
  const [dtAte, setDtAte] = useState(inicial.dtAte)

  useEffect(() => {
    salvarFiltros({ dtDe, dtAte, status: filtroStatus, busca })
  }, [dtDe, dtAte, filtroStatus, busca])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const data = await listarPedidos({ status: filtroStatus || undefined })
      setPedidos(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }, [filtroStatus])

  useEffect(() => { void carregar() }, [carregar])

  const pedidosFiltrados = pedidos.filter((p) => {
    if (dtDe && p.dtPedido < dtDe) return false
    if (dtAte && p.dtPedido > dtAte) return false
    if (!busca) return true
    const q = busca.toLowerCase()
    return (
      p.nmCliente.toLowerCase().includes(q) ||
      p.nrCpfCnpj?.includes(q) ||
      String(p.idPedidoWeb).includes(q)
    )
  })

  const totaisPorStatus = (s: PedidoStatus) =>
    pedidos.filter((p) => p.statusPedido === s).length

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[#13293D]">Pedidos</h1>
            <p className="text-[12px] text-gray-400">
              {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} encontrado{pedidos.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            onClick={() => navigate('/pedidos/novo')}
            className="gap-1.5 bg-[#13293D] text-white hover:bg-[#1a3a52]"
          >
            <PlusCircle className="h-4 w-4" />
            Novo Pedido
          </Button>
        </div>
      </header>

      {/* ── Cards resumo ── */}
      <div className="grid grid-cols-2 gap-3 px-6 pt-4 sm:grid-cols-4 lg:grid-cols-6">
        {(
          [
            { s: 'PENDENTE', color: 'amber' },
            { s: 'CONFIRMADO', color: 'emerald' },
            { s: 'ERRO', color: 'red' },
            { s: 'TRANSMITINDO', color: 'blue' },
          ] as { s: PedidoStatus; color: string }[]
        ).map(({ s, color }) => (
          <div
            key={s}
            onClick={() => setFiltroStatus(filtroStatus === s ? '' : s)}
            className={`cursor-pointer rounded-xl border bg-white px-4 py-3 shadow-sm transition-all hover:shadow-md ${
              filtroStatus === s ? 'ring-2 ring-[#3E7080]' : ''
            }`}
          >
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{s}</p>
            <p className={`mt-1 text-2xl font-bold text-${color}-600`}>{totaisPorStatus(s)}</p>
          </div>
        ))}
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-4">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, CNPJ ou nº…"
            className="h-9 pl-8 text-[13px]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-gray-400 whitespace-nowrap">De</span>
          <input
            type="date"
            value={dtDe}
            onChange={(e) => setDtDe(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3E7080]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-gray-400 whitespace-nowrap">Até</span>
          <input
            type="date"
            value={dtAte}
            onChange={(e) => setDtAte(e.target.value)}
            className="h-9 rounded-md border border-gray-200 bg-white px-2 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3E7080]"
          />
        </div>

        {(dtDe !== hoje() || dtAte !== hoje()) && (
          <button
            onClick={() => { setDtDe(hoje()); setDtAte(hoje()) }}
            className="text-[12px] text-[#3E7080] hover:underline cursor-pointer whitespace-nowrap"
          >
            Hoje
          </button>
        )}

        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="h-9 rounded-md border border-gray-200 bg-white px-3 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3E7080]"
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={carregar}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          title="Atualizar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Tabela ── */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {erro && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
            {erro}
          </div>
        )}

        {!erro && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 bg-[#13293D] text-white">
                  {['Nº', 'Cliente', 'CNPJ/CPF', 'Data', 'Condição', 'Total', 'Status', 'ERP', ''].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold tracking-wide">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                )}
                {!loading && pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center">
                      <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                      <p className="text-[13px] text-gray-400">Nenhum pedido encontrado</p>
                    </td>
                  </tr>
                )}
                {!loading &&
                  pedidosFiltrados.map((p, i) => (
                    <tr
                      key={p.idPedidoWeb}
                      onClick={() => navigate(`/pedidos/${p.idPedidoWeb}`)}
                      className={`cursor-pointer border-b border-gray-50 transition-colors hover:bg-[#F2F5F7] ${
                        i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-[#13293D]">
                        #{p.idPedidoWeb}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                        {p.nmCliente}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-[12px]">
                        {fmtCpfCnpj(p.nrCpfCnpj)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fmtData(p.dtPedido)}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">
                        {p.dsCondicaoPagamento ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#13293D]">
                        {fmtMoeda(p.vlTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.statusPedido} />
                      </td>
                      <td className="px-4 py-3 text-[12px]">
                        {p.stIntegradoErp === 'S' ? (
                          <span className="text-emerald-600 font-semibold">
                            #{p.cdPreVendaErp}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[#3E7080] font-medium">
                        Ver →
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
