import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Send, XCircle, RefreshCw, CheckCircle, AlertCircle,
  Clock, Printer, PlusCircle, TriangleAlert, ChevronDown, FileText, Receipt,
} from 'lucide-react'
import { obterPedido, transmitirPedido, cancelarPedido, finalizarPedido, obterEmpresa } from '@/lib/api'
import type { EmpresaInfo } from '@/lib/api'
import { fmtMoeda, fmtData, fmtCpfCnpj } from '@/lib/fmt'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { imprimirPedido, imprimirCupom } from '@/lib/print'
import type { PedidoDetalhe } from '@/types/pedido'

export function DetalhePedidoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [pedido, setPedido] = useState<PedidoDetalhe | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [acao, setAcao] = useState<'transmitindo' | 'cancelando' | 'finalizando' | null>(null)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [dropdownImpressao, setDropdownImpressao] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  async function carregar() {
    if (!id) return
    setLoading(true)
    setErro(null)
    try {
      const data = await obterPedido(Number(id))
      setPedido(data)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pedido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void carregar()
    obterEmpresa().then(setEmpresa).catch(() => {})
  }, [id])

  useEffect(() => {
    if ((location.state as { print?: boolean } | null)?.print && pedido && empresa) {
      imprimirPedido(pedido, empresa)
    }
  }, [pedido, empresa, location.state])

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownImpressao(false)
      }
    }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [])

  async function handleFinalizar() {
    if (!pedido) return
    setErro(null)
    setAcao('finalizando')
    try {
      const atualizado = await finalizarPedido(pedido.idPedidoWeb)
      setPedido(atualizado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao finalizar pedido')
    } finally {
      setAcao(null)
    }
  }

  async function handleTransmitir() {
    if (!pedido) return
    setErro(null)
    setAcao('transmitindo')
    try {
      const atualizado = await transmitirPedido(pedido.idPedidoWeb)
      setPedido(atualizado)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao transmitir ao ERP')
    } finally {
      setAcao(null)
    }
  }

  async function handleCancelar() {
    if (!pedido) return
    setAcao('cancelando')
    try {
      await cancelarPedido(pedido.idPedidoWeb, motivoCancelamento || undefined)
      navigate('/pedidos/novo', { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cancelar')
      setAcao(null)
      setConfirmarCancelar(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-[#3E7080]" />
      </div>
    )
  }

  if (!pedido) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-gray-400">
        <AlertCircle className="h-8 w-8" />
        <p className="text-[13px]">{erro ?? 'Pedido não encontrado'}</p>
        <button onClick={() => navigate('/pedidos')} className="text-[#3E7080] hover:underline text-[13px] cursor-pointer">
          Voltar à lista
        </button>
      </div>
    )
  }

  const ehRascunho = pedido.statusPedido === 'RASCUNHO'
  const podePedirTransmissao = ['PENDENTE', 'ERRO'].includes(pedido.statusPedido)
  const podeCancelar = ['RASCUNHO', 'PENDENTE', 'ERRO', 'CONFIRMADO'].includes(pedido.statusPedido)
  const cancelado = pedido.statusPedido === 'CANCELADO'
  const confirmado = pedido.statusPedido === 'CONFIRMADO'

  return (
    <div className="flex flex-col h-full bg-[#F5F7FA] print:bg-white">

      {/* ── Topo navy ── */}
      <header className="bg-[#13293D] px-6 py-3 flex items-center justify-between shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/pedidos')}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Pedido #{pedido.idPedidoWeb}</span>
              <StatusBadge status={pedido.statusPedido} />
            </div>
            <p className="text-[11px] text-white/50">
              {fmtData(pedido.dtPedido)} · {pedido.nmUsuarioWeb ?? 'sistema'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownImpressao((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
            {dropdownImpressao && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-gray-200 bg-white shadow-xl z-50">
                <button onClick={() => { if (pedido && empresa) imprimirPedido(pedido, empresa); setDropdownImpressao(false) }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 rounded-t-lg">
                  <FileText className="h-3.5 w-3.5 text-gray-400" /> Folha A4
                </button>
                <button onClick={() => { if (pedido && empresa) imprimirCupom(pedido, empresa); setDropdownImpressao(false) }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-[12px] text-gray-700 hover:bg-gray-50 rounded-b-lg border-t border-gray-100">
                  <Receipt className="h-3.5 w-3.5 text-gray-400" /> Cupom 80mm
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/pedidos/novo')}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-white/20"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Novo Pedido
          </button>
        </div>
      </header>

      {/* ── Erro ── */}
      {erro && (
        <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-[13px] text-red-700 ring-1 ring-red-200 print:hidden">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      <div className="flex flex-1 overflow-auto gap-4 p-5">

        {/* ── Coluna principal ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Cliente */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Cliente</h2>
            </div>
            <div className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Nome / Razão Social</p>
                <p className="mt-0.5 text-[14px] font-semibold text-[#13293D]">{pedido.nmCliente}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">CPF / CNPJ</p>
                <p className="mt-0.5 text-[13px] font-mono font-medium text-gray-700">{fmtCpfCnpj(pedido.nrCpfCnpj)}</p>
              </div>
              {pedido.dsTelefone && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Telefone</p>
                  <p className="mt-0.5 text-[13px] text-gray-700">{pedido.dsTelefone}</p>
                </div>
              )}
              {pedido.dsEmail && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">E-mail</p>
                  <p className="mt-0.5 text-[13px] text-gray-700">{pedido.dsEmail}</p>
                </div>
              )}
              {pedido.dsCidade && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cidade / UF</p>
                  <p className="mt-0.5 text-[13px] text-gray-700">{pedido.dsCidade} / {pedido.dsUf}</p>
                </div>
              )}
            </div>
          </section>

          {/* Itens */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Itens do Pedido</h2>
              <span className="rounded-full bg-[#EDF3F5] px-2.5 py-0.5 text-[11px] font-bold text-[#3E7080]">
                {pedido.itens.length}
              </span>
            </div>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F8FAFB] text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="px-5 py-2.5 text-left">Produto</th>
                  <th className="px-4 py-2.5 text-center">Un.</th>
                  <th className="px-4 py-2.5 text-center">Qtd</th>
                  <th className="px-4 py-2.5 text-right">Preço Un.</th>
                  <th className="px-5 py-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {pedido.itens.map((item, i) => (
                  <tr key={item.idItem} className={`border-t border-gray-50 ${i % 2 === 1 ? 'bg-[#FAFBFC]' : ''}`}>
                    <td className="px-5 py-3 font-medium text-gray-800">{item.dsProduto}</td>
                    <td className="px-4 py-3 text-center text-gray-400">{item.dsUnidade}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-700">{item.qtItem}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtMoeda(item.vlUnitario)}</td>
                    <td className="px-5 py-3 text-right font-bold text-[#13293D]">{fmtMoeda(item.vlTotalItem)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-[#F8FAFB]">
                  {pedido.vlDesconto > 0 && (
                    <>
                      <td colSpan={4} className="px-5 py-2 text-right text-[12px] text-gray-400">Desconto</td>
                      <td className="px-5 py-2 text-right text-[12px] text-red-400 font-semibold">- {fmtMoeda(pedido.vlDesconto)}</td>
                    </>
                  )}
                </tr>
                <tr className={pedido.vlDesconto > 0 ? '' : 'border-t-2 border-gray-200 bg-[#F8FAFB]'}>
                  <td colSpan={4} className="px-5 py-3 text-right text-[12px] font-bold text-gray-600 uppercase tracking-wide">Total</td>
                  <td className="px-5 py-3 text-right text-[16px] font-bold text-[#13293D]">{fmtMoeda(pedido.vlTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          {/* Histórico */}
          {pedido.historico && pedido.historico.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm print:hidden">
              <div className="border-b border-gray-100 px-5 py-3">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Histórico</h2>
              </div>
              <div className="divide-y divide-gray-50 px-5">
                {pedido.historico.map((h) => (
                  <div key={h.idHist} className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EDF3F5]">
                      <Clock className="h-3 w-3 text-[#3E7080]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-800">{h.dsEvento}</p>
                      <p className="text-[11px] text-gray-400">
                        {fmtData(h.dtEvento)} · {h.nmUsuario}
                        {h.statusAnterior && (
                          <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px]">
                            {h.statusAnterior} → {h.statusNovo}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Painel lateral ── */}
        <aside className="w-64 shrink-0 space-y-3 print:hidden">

          {/* Totais */}
          <div className={`rounded-xl border bg-white shadow-sm ${cancelado ? 'opacity-50' : 'border-gray-200'}`}>
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Totais</h2>
            </div>
            <div className={`space-y-2 p-4 text-[13px] ${cancelado ? 'line-through decoration-red-300' : ''}`}>
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span><span>{fmtMoeda(pedido.vlSubtotal)}</span>
              </div>
              {pedido.vlDesconto > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Desconto</span><span className="text-red-400">- {fmtMoeda(pedido.vlDesconto)}</span>
                </div>
              )}
              {pedido.vlFrete > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Frete</span><span>{fmtMoeda(pedido.vlFrete)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-[#13293D]">
                <span>Total</span>
                <span className="text-base">{fmtMoeda(pedido.vlTotal)}</span>
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div className={`rounded-xl border bg-white p-4 shadow-sm ${cancelado ? 'opacity-50 border-gray-100' : 'border-gray-200'}`}>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Pagamento</p>
            <p className="font-semibold text-gray-800">{pedido.dsCondicaoPagamento ?? '—'}</p>
            {pedido.qtdParcelas && pedido.qtdParcelas > 1 && (
              <p className="text-[12px] text-gray-500">
                {pedido.qtdParcelas}x de {pedido.vlParcelas ? fmtMoeda(pedido.vlParcelas) : '—'}
              </p>
            )}
            {pedido.dt1Vencimento && (
              <p className="text-[11px] text-gray-400 mt-0.5">
                Venc.: {fmtData(pedido.dt1Vencimento)}
              </p>
            )}
          </div>

          {/* ERP confirmado */}
          {confirmado && pedido.cdPreVendaErp && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
                <p className="text-[12px] font-bold uppercase tracking-wider text-emerald-700">Integrado ao ERP</p>
              </div>
              <p className="text-[10px] text-emerald-500 uppercase tracking-wider">Nº gerado no ERP</p>
              <p className="text-[15px] font-bold text-emerald-700">Pré-Venda ERP #{pedido.cdPreVendaErp}</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">(independente do nº do pedido web)</p>
              {pedido.dtIntegracaoErp && (
                <p className="text-[11px] text-emerald-500 mt-1">{fmtData(pedido.dtIntegracaoErp)}</p>
              )}
            </div>
          )}

          {/* Status cancelado */}
          {cancelado && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <XCircle className="mx-auto mb-1.5 h-5 w-5 text-red-400" />
              <p className="text-[12px] font-bold uppercase tracking-wider text-red-500">Cancelado</p>
              <p className="mt-1 text-[11px] text-red-400">Este pedido não possui valor vigente.</p>
            </div>
          )}

          {/* ── Ações ── */}
          {!cancelado && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-[#3E7080]">Ações</h2>
              </div>
              <div className="p-3 space-y-2">

                {ehRascunho && (
                  <button
                    onClick={handleFinalizar}
                    disabled={acao === 'finalizando'}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#3E7080] px-3 py-3 text-[13px] font-bold text-white transition hover:bg-[#2d5a6b] active:scale-[.98] disabled:opacity-60"
                  >
                    {acao === 'finalizando' ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Finalizando…</>
                    ) : (
                      <><CheckCircle className="h-4 w-4" /> Finalizar Pedido</>
                    )}
                  </button>
                )}

                {podePedirTransmissao && (
                  <button
                    onClick={handleTransmitir}
                    disabled={acao === 'transmitindo'}
                    className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-3 text-[13px] font-bold text-white transition active:scale-[.98] disabled:opacity-60 ${
                      pedido.statusPedido === 'ERRO'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-[#13293D] hover:bg-[#1a3a52]'
                    }`}
                  >
                    {acao === 'transmitindo' ? (
                      <><RefreshCw className="h-4 w-4 animate-spin" /> Transmitindo…</>
                    ) : pedido.statusPedido === 'ERRO' ? (
                      <><RefreshCw className="h-4 w-4" /> Reenviar ao ERP</>
                    ) : (
                      <><Send className="h-4 w-4" /> Enviar ao ERP</>
                    )}
                  </button>
                )}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => { if (pedido && empresa) imprimirPedido(pedido, empresa) }}
                    className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-700">A4</p>
                      <p className="text-[9px] text-gray-400">Folha</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { if (pedido && empresa) imprimirCupom(pedido, empresa) }}
                    className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <Receipt className="h-4 w-4 shrink-0 text-gray-400" />
                    <div>
                      <p className="text-[11px] font-semibold text-gray-700">Cupom</p>
                      <p className="text-[9px] text-gray-400">80mm</p>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => navigate('/pedidos/novo')}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-gray-200 px-3 py-2.5 text-left transition hover:bg-gray-50"
                >
                  <PlusCircle className="h-4 w-4 shrink-0 text-gray-500" />
                  <div>
                    <p className="text-[12px] font-semibold text-gray-700">Novo pedido</p>
                    <p className="text-[10px] text-gray-400">Iniciar atendimento</p>
                  </div>
                </button>

                {podeCancelar && !confirmarCancelar && (
                  <button
                    onClick={() => { setConfirmarCancelar(true); setMotivoCancelamento('') }}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-red-100 px-3 py-2.5 text-left text-red-500 transition hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 shrink-0" />
                    <p className="text-[12px] font-semibold">Cancelar pedido</p>
                  </button>
                )}

                {confirmarCancelar && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
                    {confirmado && (
                      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-700">Atenção — Pré-Venda no ERP</p>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          Este pedido gerou a <strong>Pré-Venda ERP #{pedido.cdPreVendaErp}</strong>. O cancelamento aqui
                          altera apenas o status no sistema web — a Pré-Venda no ERP <strong>não será cancelada automaticamente</strong> e
                          precisará ser estornada manualmente no sistema.
                        </p>
                      </div>
                    )}
                    <p className="text-[12px] text-red-700 font-medium">Motivo do cancelamento</p>
                    <textarea
                      value={motivoCancelamento}
                      onChange={(e) => setMotivoCancelamento(e.target.value)}
                      placeholder="Descreva o motivo (opcional)…"
                      rows={3}
                      className="w-full rounded-md border border-red-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelar}
                        disabled={acao === 'cancelando'}
                        className="flex-1 cursor-pointer rounded-md bg-red-500 py-1.5 text-[12px] font-semibold text-white hover:bg-red-600 disabled:opacity-60"
                      >
                        {acao === 'cancelando' ? '…' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setConfirmarCancelar(false)}
                        className="flex-1 cursor-pointer rounded-md border border-gray-200 bg-white py-1.5 text-[12px] font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Voltar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Novo pedido quando cancelado */}
          {cancelado && (
            <button
              onClick={() => navigate('/pedidos/novo')}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#13293D] px-4 py-3 text-[13px] font-semibold text-white hover:bg-[#1a3a52]"
            >
              <PlusCircle className="h-4 w-4" />
              Novo Pedido
            </button>
          )}
        </aside>
      </div>

    </div>
  )
}
