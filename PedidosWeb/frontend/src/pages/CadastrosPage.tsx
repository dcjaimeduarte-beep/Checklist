import { useState, useEffect } from 'react'
import { Search, Loader2, Package, Users, Box, X, MapPin, Phone, Mail, Tag, Layers, TrendingUp } from 'lucide-react'
import { buscarClientes, buscarProdutos } from '@/lib/api'
import { fmtMoeda } from '@/lib/fmt'
import { Input } from '@/components/ui/input'
import type { ClienteErp, ProdutoErp } from '@/types/pedido'

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'

function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Thumb de produto ─────────────────────────────────────────────
function ProdutoThumb({
  cdProduto,
  size = 48,
  onClick,
}: {
  cdProduto: number
  size?: number
  onClick?: () => void
}) {
  const [falhou, setFalhou] = useState(false)
  const src = `${API_BASE}/produtos/${cdProduto}/imagem?v=1`
  const cls = `shrink-0 rounded-lg ${onClick ? 'cursor-zoom-in' : ''}`

  if (falhou) {
    return (
      <div style={{ width: size, height: size }}
        className={`flex items-center justify-center bg-gray-100 text-gray-300 ${cls}`}>
        <Package style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className={`object-cover border border-gray-100 ${cls}`}
      onError={() => setFalhou(true)}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
    />
  )
}

// ── Modal de detalhe do cliente ──────────────────────────────────
function ModalCliente({ cliente, onFechar }: { cliente: ClienteErp; onFechar: () => void }) {
  const ativo = cliente.inativo !== 'S'
  const endereco = [cliente.dsEndereco, cliente.dsNumero, cliente.dsComplemento].filter(Boolean).join(', ')
  const cidadeUf = [cliente.dsCidade, cliente.dsUf].filter(Boolean).join(' / ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho */}
        <div className="relative bg-[#13293D] px-6 pt-6 pb-5">
          <button onClick={onFechar}
            className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-lg font-bold text-white">
              {(cliente.nmFantasia || cliente.nmRazSoc)[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/50">Cliente</p>
              <p className="text-lg font-bold text-white leading-tight">{cliente.nmFantasia || cliente.nmRazSoc}</p>
              {cliente.nmFantasia && cliente.nmRazSoc !== cliente.nmFantasia && (
                <p className="text-[12px] text-white/60 mt-0.5">{cliente.nmRazSoc}</p>
              )}
            </div>
          </div>
          <span className={`mt-3 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            ativo ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'
          }`}>
            {ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>

        {/* Corpo */}
        <div className="divide-y divide-gray-50 px-6 py-4 space-y-0">
          {cliente.cdCgc && (
            <Row icon={<Tag className="h-3.5 w-3.5" />} label="CNPJ / CPF" value={cliente.cdCgc} mono />
          )}
          {cliente.cdFoneCliente && (
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={cliente.cdFoneCliente} />
          )}
          {cliente.dsEmailCliente && (
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="E-mail" value={cliente.dsEmailCliente} />
          )}
          {(endereco || cidadeUf || cliente.dsCep) && (
            <Row
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Endereço"
              value={[endereco, cidadeUf, cliente.dsCep && `CEP: ${cliente.dsCep}`].filter(Boolean).join(' — ')}
            />
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 text-center">
          <button onClick={onFechar} className="cursor-pointer text-[12px] text-gray-400 hover:text-gray-600">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lightbox — imagem ampliada ───────────────────────────────────
function Lightbox({ cdProduto, onFechar }: { cdProduto: number; onFechar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
      onClick={onFechar}
    >
      <button
        onClick={onFechar}
        className="absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={`${API_BASE}/produtos/${cdProduto}/imagem?v=1`}
        alt=""
        className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  )
}

// ── Modal de detalhe do produto ──────────────────────────────────
function ModalProduto({ produto, onFechar }: { produto: ProdutoErp; onFechar: () => void }) {
  const temEstoque = (produto.qtEstoque ?? 0) > 0
  const [lightbox, setLightbox] = useState(false)

  return (
    <>
      {lightbox && <Lightbox cdProduto={produto.cdProduto} onFechar={() => setLightbox(false)} />}
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" onClick={onFechar}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Cabeçalho com imagem */}
        <div className="relative bg-[#13293D] px-6 pt-6 pb-5 flex gap-4 items-start">
          <button onClick={onFechar}
            className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
            <X className="h-4 w-4" />
          </button>
          <ProdutoThumb cdProduto={produto.cdProduto} size={72} onClick={() => setLightbox(true)} />
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded bg-white/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-white/70 mb-1">
              #{produto.cdProduto}
            </span>
            <p className="text-[15px] font-bold text-white leading-tight">{produto.dsProduto}</p>
            <p className="text-[11px] text-white/50 mt-0.5">Unidade: {produto.dsUnidade}</p>
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-b border-gray-100">
          <div className="flex flex-col items-center py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Preço de Venda</p>
            <p className="text-xl font-bold text-[#13293D]">{fmtMoeda(produto.vlUnitario)}</p>
          </div>
          <div className="flex flex-col items-center py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Estoque</p>
            <p className={`text-xl font-bold ${temEstoque ? 'text-emerald-600' : 'text-red-400'}`}>
              {produto.qtEstoque ?? 0}
            </p>
            <p className="text-[10px] text-gray-400">{temEstoque ? 'disponível' : 'sem estoque'}</p>
          </div>
        </div>

        {/* Detalhes adicionais */}
        <div className="px-6 py-4 space-y-0 divide-y divide-gray-50">
          <Row icon={<Layers className="h-3.5 w-3.5" />} label="Unidade de medida" value={produto.dsUnidade} />
          {produto.cdCfop && (
            <Row icon={<TrendingUp className="h-3.5 w-3.5" />} label="CFOP" value={String(produto.cdCfop)} mono />
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-3 text-center">
          <button onClick={onFechar} className="cursor-pointer text-[12px] text-gray-400 hover:text-gray-600">
            Fechar
          </button>
        </div>
      </div>
    </div>
    </>
  )
}

// ── Linha de detalhe reutilizável ────────────────────────────────
function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 shrink-0 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`text-[13px] text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

// ── Aba Clientes ─────────────────────────────────────────────────
function AbaClientes() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<ClienteErp[]>([])
  const [loading, setLoading] = useState(false)
  const [selecionado, setSelecionado] = useState<ClienteErp | null>(null)
  const debBusca = useDebounce(busca)

  function executarBusca(termo: string) {
    if (termo.trim().length < 1) { setClientes([]); return }
    setLoading(true)
    buscarClientes(termo)
      .then(setClientes)
      .catch(() => setClientes([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { executarBusca(debBusca) }, [debBusca])

  return (
    <div className="space-y-4">
      {selecionado && <ModalCliente cliente={selecionado} onFechar={() => setSelecionado(null)} />}

      <div className="flex gap-2">
        <div className="relative flex-1">
          {loading
            ? <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />
            : <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          }
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executarBusca(busca)}
            placeholder="Buscar por nome, razão social ou CNPJ…"
            className="h-10 pl-8 text-[13px]" autoFocus />
        </div>
        <button onClick={() => executarBusca(busca)} disabled={loading}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#13293D] px-4 text-[13px] font-medium text-white hover:bg-[#1a3a52] disabled:opacity-60">
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
      </div>

      {clientes.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px] text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase text-gray-400">
                <th className="px-4 py-3 text-left">Nome / Razão Social</th>
                <th className="px-4 py-3 text-left w-40">CNPJ / CPF</th>
                <th className="px-4 py-3 text-left w-36">Telefone</th>
                <th className="px-4 py-3 text-left w-44">Cidade / UF</th>
                <th className="px-4 py-3 text-left w-20">Situação</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.cdCliente}
                  onClick={() => setSelecionado(c)}
                  className="border-b border-gray-50 cursor-pointer hover:bg-[#EDF3F5] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{c.nmFantasia || c.nmRazSoc}</p>
                    {c.nmFantasia && c.nmRazSoc !== c.nmFantasia && (
                      <p className="text-[11px] text-gray-400">{c.nmRazSoc}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-gray-500">{c.cdCgc || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.cdFoneCliente || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {[c.dsCidade, c.dsUf].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.inativo === 'S' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {c.inativo === 'S' ? 'Inativo' : 'Ativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : debBusca.trim().length > 0 && !loading ? (
        <Empty icon={<Users className="h-10 w-10" />} title="Nenhum cliente encontrado" sub="Tente outro nome ou CNPJ" />
      ) : (
        <Empty icon={<Users className="h-10 w-10" />} title="Digite para buscar clientes" />
      )}
    </div>
  )
}

// ── Aba Produtos ─────────────────────────────────────────────────
function AbaProdutos() {
  const [busca, setBusca] = useState('')
  const [produtos, setProdutos] = useState<ProdutoErp[]>([])
  const [loading, setLoading] = useState(false)
  const [selecionado, setSelecionado] = useState<ProdutoErp | null>(null)
  const debBusca = useDebounce(busca)

  function executarBusca(termo: string) {
    if (termo.trim().length < 1) { setProdutos([]); return }
    setLoading(true)
    buscarProdutos(termo)
      .then(setProdutos)
      .catch(() => setProdutos([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { executarBusca(debBusca) }, [debBusca])

  return (
    <div className="space-y-4">
      {selecionado && <ModalProduto produto={selecionado} onFechar={() => setSelecionado(null)} />}

      <div className="flex gap-2">
        <div className="relative flex-1">
          {loading
            ? <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />
            : <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          }
          <Input value={busca} onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executarBusca(busca)}
            placeholder="Buscar por nome, código ou referência…"
            className="h-10 pl-8 text-[13px]" autoFocus />
        </div>
        <button onClick={() => executarBusca(busca)} disabled={loading}
          className="flex h-10 cursor-pointer items-center gap-2 rounded-md bg-[#13293D] px-4 text-[13px] font-medium text-white hover:bg-[#1a3a52] disabled:opacity-60">
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
      </div>

      {produtos.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[600px] text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-semibold uppercase text-gray-400">
                <th className="px-4 py-3 w-16 text-center">Img</th>
                <th className="px-4 py-3 text-left w-24">Código</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-center w-20">Unid.</th>
                <th className="px-4 py-3 text-right w-32">Preço</th>
                <th className="px-4 py-3 text-right w-28">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.cdProduto}
                  onClick={() => setSelecionado(p)}
                  className="border-b border-gray-50 cursor-pointer hover:bg-[#EDF3F5] transition-colors">
                  <td className="px-4 py-2 text-center">
                    <div className="flex justify-center">
                      <ProdutoThumb cdProduto={p.cdProduto} size={48} />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-600">
                      #{p.cdProduto}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">{p.dsProduto}</td>
                  <td className="px-4 py-2 text-center text-gray-500">{p.dsUnidade}</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#13293D]">{fmtMoeda(p.vlUnitario)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-medium ${(p.qtEstoque ?? 0) > 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                      {p.qtEstoque ?? 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : debBusca.trim().length > 0 && !loading ? (
        <Empty icon={<Box className="h-10 w-10" />} title="Nenhum produto encontrado" sub="Tente outro nome, código ou referência" />
      ) : (
        <Empty icon={<Box className="h-10 w-10" />} title="Digite para buscar produtos" />
      )}
    </div>
  )
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 text-center">
      <span className="mb-3 text-gray-200">{icon}</span>
      <p className="text-[13px] font-medium text-gray-400">{title}</p>
      {sub && <p className="mt-1 text-[12px] text-gray-300">{sub}</p>}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────
type Aba = 'clientes' | 'produtos'

export function CadastrosPage() {
  const [aba, setAba] = useState<Aba>('clientes')

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-[#13293D]">Consulta de Cadastros</h1>
        <p className="text-[12px] text-gray-400">Clientes e produtos do ERP</p>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit shadow-sm">
          <button onClick={() => setAba('clientes')}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
              aba === 'clientes' ? 'bg-[#13293D] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Users className="h-3.5 w-3.5" />
            Clientes
          </button>
          <button onClick={() => setAba('produtos')}
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all ${
              aba === 'produtos' ? 'bg-[#13293D] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Box className="h-3.5 w-3.5" />
            Produtos
          </button>
        </div>

        {aba === 'clientes' ? <AbaClientes /> : <AbaProdutos />}
      </div>
    </div>
  )
}
