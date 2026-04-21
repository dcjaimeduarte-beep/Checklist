import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, Plus, Trash2, Loader2, ChevronDown, CheckCircle, SendHorizonal, Printer, FileText, RefreshCcw, Receipt, X, Package } from 'lucide-react'
import { buscarClientes, buscarProdutos, listarCondicoesPagamento, criarPedido, transmitirPedido, obterClientePadrao, obterEmpresa } from '@/lib/api'
import type { EmpresaInfo } from '@/lib/api'
import { fmtMoeda } from '@/lib/fmt'
import { imprimirPedido, imprimirCupom } from '@/lib/print'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ClienteErp, ProdutoErp, CondicaoPagamento, PedidoDetalhe } from '@/types/pedido'

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api'

function ProdutoThumb({ cdProduto, size = 40 }: { cdProduto: number; size?: number }) {
  const [falhou, setFalhou] = useState(false)

  if (falhou) {
    return (
      <div style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-300">
        <Package className="h-4 w-4" />
      </div>
    )
  }
  return (
    <img
      src={`${API_BASE}/produtos/${cdProduto}/imagem?v=1`}
      alt=""
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md object-cover border border-gray-100"
      onError={() => setFalhou(true)}
    />
  )
}

interface ItemForm {
  cdProdutoErp: number
  dsProduto: string
  dsUnidade: string
  qtItem: number
  vlUnitario: number
  vlDesconto: number
  temImagem?: boolean
}

function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

interface ModalAcoesProps {
  pedido: PedidoDetalhe
  onNovoP: () => void
  onVerPedido: () => void
  onEnviarErp: () => void
  onImprimirA4: () => void
  onImprimirCupom: () => void
  onFechar: () => void
  enviando: boolean
}

function ModalAcoes({ pedido, onNovoP, onVerPedido, onEnviarErp, onImprimirA4, onImprimirCupom, onFechar, enviando }: ModalAcoesProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Cabeçalho verde */}
        <div className="relative bg-emerald-500 px-6 pt-6 pb-5 text-center">
          <button
            onClick={onFechar}
            className="absolute right-3 top-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-100">Pedido salvo</p>
          <p className="mt-0.5 text-2xl font-bold text-white">{fmtMoeda(pedido.vlTotal)}</p>
        </div>

        {/* Resumo */}
        <div className="border-b border-gray-100 px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-gray-500">Pedido</span>
            <span className="font-semibold text-[#13293D]">#{pedido.idPedidoWeb}</span>
          </div>
          <div className="flex items-center justify-between text-[12px] mt-0.5">
            <span className="text-gray-500">Cliente</span>
            <span className="font-medium text-gray-700 max-w-[180px] truncate text-right">{pedido.nmCliente}</span>
          </div>
          {pedido.dsCondicaoPagamento && (
            <div className="flex items-center justify-between text-[12px] mt-0.5">
              <span className="text-gray-500">Pagamento</span>
              <span className="font-medium text-gray-700">{pedido.dsCondicaoPagamento}</span>
            </div>
          )}
        </div>

        {/* Ações primárias */}
        <div className="p-4 space-y-2">
          <button
            onClick={onEnviarErp}
            disabled={enviando}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#13293D] px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#1a3a52] disabled:opacity-60"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            Enviar ao ERP agora
          </button>

          {/* Impressão — dois botões lado a lado */}
          <div className="flex gap-2">
            <button
              onClick={onImprimirA4}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              Folha A4
            </button>
            <button
              onClick={onImprimirCupom}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Receipt className="h-4 w-4 text-gray-400" />
              Cupom 80mm
            </button>
          </div>
        </div>

        {/* Ações secundárias */}
        <div className="flex border-t border-gray-100">
          <button
            onClick={onNovoP}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-[#3E7080] hover:bg-[#F2F5F7]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Novo pedido
          </button>
          <div className="w-px bg-gray-100" />
          <button
            onClick={onVerPedido}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 py-3 text-[12px] font-semibold text-gray-400 hover:bg-gray-50"
          >
            <FileText className="h-3.5 w-3.5" />
            Ver pedido
          </button>
        </div>

        {/* Fechar modal */}
        <div className="border-t border-gray-100 px-4 py-2 text-center">
          <button
            onClick={onFechar}
            className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600 hover:underline"
          >
            Fechar e continuar editando
          </button>
        </div>
      </div>
    </div>
  )
}

export function NovoPedidoPage() {
  const navigate = useNavigate()

  // Cliente
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteErp[]>([])
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteErp | null>(null)
  const [loadingCliente, setLoadingCliente] = useState(false)
  const [idxCliente, setIdxCliente] = useState(-1)
  const debBuscaCliente = useDebounce(buscaCliente, 350)

  // Produto
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtos, setProdutos] = useState<ProdutoErp[]>([])
  const [loadingProduto, setLoadingProduto] = useState(false)
  const [idxProduto, setIdxProduto] = useState(-1)
  const debBuscaProduto = useDebounce(buscaProduto, 350)

  // Itens
  const [itens, setItens] = useState<ItemForm[]>([])

  // Pagamento
  const [condicoes, setCondicoes] = useState<CondicaoPagamento[]>([])
  const [cdCondicao, setCdCondicao] = useState<number | ''>('')

  // Obs / envio
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Modal pós-salvo
  const [pedidoCriado, setPedidoCriado] = useState<PedidoDetalhe | null>(null)
  const [enviandoErp, setEnviandoErp] = useState(false)
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)

  const clienteInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listarCondicoesPagamento().then(setCondicoes).catch(() => {})
    obterClientePadrao().then((c) => { if (c) setClienteSelecionado(c) }).catch(() => {})
    obterEmpresa().then(setEmpresa).catch(() => {})
  }, [])

  useEffect(() => {
    if (debBuscaCliente.length < 1) { setClientes([]); return }
    setLoadingCliente(true)
    buscarClientes(debBuscaCliente)
      .then((r) => { setClientes(r); setIdxCliente(-1) })
      .catch(() => setClientes([]))
      .finally(() => setLoadingCliente(false))
  }, [debBuscaCliente])

  useEffect(() => {
    if (debBuscaProduto.length < 1) { setProdutos([]); return }
    setLoadingProduto(true)
    buscarProdutos(debBuscaProduto)
      .then((r) => { setProdutos(r); setIdxProduto(-1) })
      .catch(() => setProdutos([]))
      .finally(() => setLoadingProduto(false))
  }, [debBuscaProduto])

  function selecionarCliente(c: ClienteErp) {
    setClienteSelecionado(c)
    setBuscaCliente('')
    setClientes([])
  }

  function adicionarProduto(p: ProdutoErp) {
    setItens((prev) => {
      const existente = prev.findIndex((i) => i.cdProdutoErp === p.cdProduto)
      if (existente >= 0) {
        return prev.map((item, idx) =>
          idx === existente ? { ...item, qtItem: item.qtItem + 1 } : item,
        )
      }
      return [
        ...prev,
        {
          cdProdutoErp: p.cdProduto,
          dsProduto: p.dsProduto,
          dsUnidade: p.dsUnidade,
          qtItem: 1,
          vlUnitario: p.vlUnitario,
          vlDesconto: 0,
          temImagem: p.temImagem,
        },
      ]
    })
    setBuscaProduto('')
    setProdutos([])
  }

  function atualizarItem(idx: number, campo: keyof ItemForm, valor: number) {
    setItens((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)),
    )
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function resetarFormulario() {
    setItens([])
    setCdCondicao('')
    setObservacao('')
    setErro(null)
    setPedidoCriado(null)
    setBuscaCliente('')
    obterClientePadrao()
      .then((c) => setClienteSelecionado(c))
      .catch(() => setClienteSelecionado(null))
  }

  const subtotal = itens.reduce((s, i) => s + i.qtItem * i.vlUnitario, 0)
  const totalDesconto = itens.reduce((s, i) => s + i.vlDesconto, 0)
  const total = subtotal - totalDesconto

  const condicaoSelecionada = condicoes.find((c) => c.cdCondicao === cdCondicao)

  async function onSubmit() {
    if (!clienteSelecionado) { setErro('Selecione um cliente.'); return }
    if (itens.length === 0) { setErro('Adicione ao menos um produto.'); return }
    if (!cdCondicao) { setErro('Selecione a condição de pagamento.'); return }

    setErro(null)
    setSalvando(true)
    try {
      const pedido = await criarPedido({
        cdEmpresa: 1,
        cdClienteErp: clienteSelecionado.cdCliente,
        nmCliente: clienteSelecionado.nmFantasia || clienteSelecionado.nmRazSoc,
        nrCpfCnpj: clienteSelecionado.cdCgc,
        dsEmail: clienteSelecionado.dsEmailCliente,
        dsTelefone: clienteSelecionado.cdFoneCliente,
        cdCondicaoPagamento: Number(cdCondicao),
        dsCondicaoPagamento: condicaoSelecionada?.dsCondicao,
        qtdParcelas: condicaoSelecionada?.qtdParcelas,
        dsObservacao: observacao || undefined,
        itens: itens.map((i) => ({
          cdProdutoErp: i.cdProdutoErp,
          dsProduto: i.dsProduto,
          dsUnidade: i.dsUnidade,
          qtItem: i.qtItem,
          vlDesconto: i.vlDesconto,
        })),
      })
      setPedidoCriado(pedido)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar pedido')
    } finally {
      setSalvando(false)
    }
  }

  async function handleEnviarErp() {
    if (!pedidoCriado) return
    setEnviandoErp(true)
    try {
      await transmitirPedido(pedidoCriado.idPedidoWeb)
      navigate(`/pedidos/${pedidoCriado.idPedidoWeb}`)
    } catch (e) {
      setEnviandoErp(false)
      setErro(e instanceof Error ? e.message : 'Erro ao transmitir ao ERP')
      setPedidoCriado(null)
    }
  }

  function handleImprimirA4() {
    if (!pedidoCriado) return
    if (empresa) imprimirPedido(pedidoCriado, empresa)
    else navigate(`/pedidos/${pedidoCriado.idPedidoWeb}`, { state: { print: true } })
  }

  function handleImprimirCupom() {
    if (!pedidoCriado || !empresa) return
    imprimirCupom(pedidoCriado, empresa)
  }

  return (
    <div className="flex flex-col h-full">
      {pedidoCriado && (
        <ModalAcoes
          pedido={pedidoCriado}
          enviando={enviandoErp}
          onEnviarErp={handleEnviarErp}
          onImprimirA4={handleImprimirA4}
          onImprimirCupom={handleImprimirCupom}
          onNovoP={resetarFormulario}
          onVerPedido={() => navigate(`/pedidos/${pedidoCriado.idPedidoWeb}`)}
          onFechar={() => setPedidoCriado(null)}
        />
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pedidos')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-[#13293D]">Novo Pedido</h1>
            <p className="text-[12px] text-gray-400">Preencha os dados e confirme</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-auto lg:flex-row">
        <div className="flex-1 space-y-5 p-4 sm:p-6">

          {/* ── Bloco Cliente ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[13px] font-semibold text-[#13293D]">Cliente</h2>

            {clienteSelecionado ? (
              <div className="rounded-lg bg-[#F2F5F7] px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#13293D]">{clienteSelecionado.nmFantasia || clienteSelecionado.nmRazSoc}</p>
                    {clienteSelecionado.nmFantasia && clienteSelecionado.nmRazSoc !== clienteSelecionado.nmFantasia && (
                      <p className="text-[11px] text-gray-400">{clienteSelecionado.nmRazSoc}</p>
                    )}
                    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] text-gray-500">
                      {clienteSelecionado.cdCgc && (
                        <span>CPF/CNPJ: <strong className="text-gray-700">{clienteSelecionado.cdCgc}</strong></span>
                      )}
                      {clienteSelecionado.cdFoneCliente && (
                        <span>Fone: <strong className="text-gray-700">{clienteSelecionado.cdFoneCliente}</strong></span>
                      )}
                      {clienteSelecionado.dsEndereco && (
                        <span className="col-span-2">
                          Endereço: <strong className="text-gray-700">
                            {[clienteSelecionado.dsEndereco, clienteSelecionado.dsNumero, clienteSelecionado.dsComplemento].filter(Boolean).join(', ')}
                          </strong>
                        </span>
                      )}
                      {(clienteSelecionado.dsCidade || clienteSelecionado.dsUf) && (
                        <span>Cidade: <strong className="text-gray-700">{[clienteSelecionado.dsCidade, clienteSelecionado.dsUf].filter(Boolean).join(' / ')}</strong></span>
                      )}
                      {clienteSelecionado.dsCep && (
                        <span>CEP: <strong className="text-gray-700">{clienteSelecionado.dsCep}</strong></span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { setClienteSelecionado(null); setTimeout(() => clienteInputRef.current?.focus(), 100) }}
                    className="cursor-pointer shrink-0 text-[12px] text-[#3E7080] hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  ref={clienteInputRef}
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Digite nome ou CNPJ do cliente…"
                  className="h-10 pl-8 text-[13px]"
                  onKeyDown={(e) => {
                    const lista = clientes.slice(0, 8)
                    if (e.key === 'ArrowDown') { e.preventDefault(); setIdxCliente((i) => Math.min(i + 1, lista.length - 1)) }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdxCliente((i) => Math.max(i - 1, 0)) }
                    else if (e.key === 'Enter' && idxCliente >= 0) { e.preventDefault(); selecionarCliente(lista[idxCliente]) }
                    else if (e.key === 'Escape') { setClientes([]); setIdxCliente(-1) }
                  }}
                />
                {loadingCliente && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />
                )}
                {clientes.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                    {clientes.slice(0, 8).map((c, i) => (
                      <button
                        key={c.cdCliente}
                        onClick={() => selecionarCliente(c)}
                        className={`flex w-full cursor-pointer flex-col px-4 py-2.5 text-left text-[13px] border-b border-gray-50 last:border-0 ${i === idxCliente ? 'bg-[#EDF3F5]' : 'hover:bg-[#F2F5F7]'}`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-gray-800">{c.nmFantasia || c.nmRazSoc}</span>
                          <span className="text-[11px] text-gray-400 shrink-0">{c.cdCgc}</span>
                        </div>
                        <div className="flex gap-3 text-[11px] text-gray-400 mt-0.5">
                          {c.cdFoneCliente && <span>{c.cdFoneCliente}</span>}
                          {(c.dsCidade || c.dsUf) && <span>{[c.dsCidade, c.dsUf].filter(Boolean).join('/')}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Bloco Produtos ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[13px] font-semibold text-[#13293D]">Itens do Pedido</h2>

            <div className="relative mb-4">
              <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                placeholder="Buscar produto por nome ou código…"
                className="h-10 pl-8 text-[13px]"
                onKeyDown={(e) => {
                  const lista = produtos.slice(0, 8)
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdxProduto((i) => Math.min(i + 1, lista.length - 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setIdxProduto((i) => Math.max(i - 1, 0)) }
                  else if (e.key === 'Enter' && idxProduto >= 0) { e.preventDefault(); adicionarProduto(lista[idxProduto]) }
                  else if (e.key === 'Escape') { setProdutos([]); setIdxProduto(-1) }
                }}
              />
              {loadingProduto && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-400" />
              )}
              {produtos.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {produtos.slice(0, 8).map((p, i) => (
                    <button
                      key={p.cdProduto}
                      onClick={() => adicionarProduto(p)}
                      className={`flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-[13px] border-b border-gray-50 last:border-0 ${i === idxProduto ? 'bg-[#EDF3F5]' : 'hover:bg-[#F2F5F7]'}`}
                    >
                      <ProdutoThumb cdProduto={p.cdProduto} size={36} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-500">
                            #{p.cdProduto}
                          </span>
                          <span className="font-medium text-gray-800 truncate">{p.dsProduto}</span>
                        </div>
                        <span className="text-[11px] text-gray-400">{p.dsUnidade}</span>
                      </div>
                      <span className="font-semibold text-[#13293D] shrink-0">{fmtMoeda(p.vlUnitario)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {itens.length > 0 ? (
              <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[540px] text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase">
                    <th className="pb-2 w-12 text-center">Img</th>
                    <th className="pb-2 text-left">Cód. / Produto</th>
                    <th className="pb-2 text-center w-20">Un</th>
                    <th className="pb-2 text-center w-24">Qtd</th>
                    <th className="pb-2 text-right w-28">Preço Un.</th>
                    <th className="pb-2 text-right w-28">Desconto</th>
                    <th className="pb-2 text-right w-28">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50">
                      <td className="py-1.5 text-center">
                        <ProdutoThumb cdProduto={item.cdProdutoErp} size={40} />
                      </td>
                      <td className="py-2.5">
                        <span className="block text-[10px] font-mono text-gray-400">#{item.cdProdutoErp}</span>
                        <span className="font-medium text-gray-800">{item.dsProduto}</span>
                      </td>
                      <td className="py-2.5 text-center text-gray-400">{item.dsUnidade}</td>
                      <td className="py-2.5 text-center">
                        <input
                          type="number" min={1} step={1}
                          value={item.qtItem}
                          onChange={(e) => atualizarItem(idx, 'qtItem', Number(e.target.value))}
                          className="w-20 rounded border border-gray-200 px-2 py-1 text-center text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3E7080]"
                        />
                      </td>
                      <td className="py-2.5 text-right text-gray-600">{fmtMoeda(item.vlUnitario)}</td>
                      <td className="py-2.5 text-right">
                        <input
                          type="number" min={0} step={0.01}
                          value={item.vlDesconto}
                          onChange={(e) => atualizarItem(idx, 'vlDesconto', Number(e.target.value))}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-[13px] focus:outline-none focus:ring-1 focus:ring-[#3E7080]"
                        />
                      </td>
                      <td className="py-2.5 text-right font-semibold text-[#13293D]">
                        {fmtMoeda(item.qtItem * item.vlUnitario - item.vlDesconto)}
                      </td>
                      <td className="py-2.5 text-center">
                        <button
                          onClick={() => removerItem(idx)}
                          className="cursor-pointer text-gray-300 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="py-6 text-center text-[13px] text-gray-300">
                Nenhum produto adicionado
              </p>
            )}
          </section>

          {/* ── Bloco Pagamento + Obs ── */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-[13px] font-semibold text-[#13293D]">Pagamento e Observações</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Forma de Pagamento</label>
                <div className="relative">
                  <select
                    value={cdCondicao}
                    onChange={(e) => setCdCondicao(e.target.value ? Number(e.target.value) : '')}
                    className="h-10 w-full appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-[13px] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3E7080]"
                  >
                    <option value="">Selecione…</option>
                    {condicoes.map((c) => (
                      <option key={c.cdCondicao} value={c.cdCondicao}>
                        {c.dsCondicao}{c.permiteParcelar && c.qtdParcelas > 1 ? ` (até ${c.qtdParcelas}x)` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                </div>
                {condicaoSelecionada?.permiteParcelar && (
                  <p className="text-[11px] text-[#3E7080]">
                    Parcelável em até {condicaoSelecionada.qtdParcelas}x
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Observação</label>
                <Input
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Observação para o pedido…"
                  className="h-10 text-[13px]"
                />
              </div>
            </div>
          </section>
        </div>

        {/* ── Painel lateral totais ── */}
        <aside className="shrink-0 border-t border-gray-200 bg-white p-4 lg:w-72 lg:border-l lg:border-t-0 lg:p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-[13px] font-semibold text-[#13293D]">Resumo</h2>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{fmtMoeda(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Desconto</span>
                <span className="text-red-500">- {fmtMoeda(totalDesconto)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold text-[#13293D]">
                <span>Total</span>
                <span className="text-lg">{fmtMoeda(total)}</span>
              </div>
            </div>

            {condicaoSelecionada && (
              <div className="rounded-lg bg-[#F2F5F7] px-3 py-2.5 text-[12px]">
                <p className="font-medium text-[#13293D]">{condicaoSelecionada.dsCondicao}</p>
                <p className="text-gray-500">{condicaoSelecionada.qtdParcelas}x</p>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-4">
            {erro && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">
                {erro}
              </p>
            )}
            <Button
              onClick={onSubmit}
              disabled={salvando}
              className="w-full bg-[#13293D] text-white hover:bg-[#1a3a52]"
            >
              {salvando ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</>
              ) : 'Salvar Pedido'}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/pedidos')}
              className="w-full"
            >
              Cancelar
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
