import { fmtMoeda, fmtData, fmtCpfCnpj } from '@/lib/fmt'
import type { PedidoDetalhe } from '@/types/pedido'
import type { EmpresaInfo } from '@/lib/api'

function fmtCnpj(v: string): string {
  const n = v.replace(/\D/g, '')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return v
}

function fmtFone(v: string): string {
  const n = v.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return v
}

interface Props {
  pedido: PedidoDetalhe
  empresa: EmpresaInfo
}

export function PrintPedido({ pedido, empresa }: Props) {
  return (
    <div className="hidden print:block font-sans text-[11px] text-gray-900 p-6 max-w-[700px] mx-auto">

      {/* ── Cabeçalho empresa ── */}
      <div className="border border-gray-400 p-3 mb-2">
        <div className="text-center mb-1">
          <p className="text-[15px] font-bold uppercase">{empresa.nmFantasia || empresa.nmRazaoSocial}</p>
          <p className="text-[10px] text-gray-600">{empresa.nmRazaoSocial}</p>
        </div>
        <div className="flex justify-between text-[10px] border-t border-gray-300 pt-1 mt-1">
          <span>CNPJ: <strong>{fmtCnpj(empresa.dsCnpj)}</strong></span>
          <span>Insc. Est.: <strong>{empresa.dsInscEstadual}</strong></span>
          <span>{empresa.dsEndereco}, {empresa.dsNumero} — {empresa.dsMunicipio}/{empresa.dsUf}</span>
          <span>Fone: <strong>{fmtFone(empresa.dsTelefone)}</strong></span>
        </div>
      </div>

      {/* ── Título do pedido ── */}
      <div className="border border-gray-400 px-3 py-1.5 mb-2 flex justify-between items-center">
        <p className="text-[13px] font-bold uppercase tracking-wide">Pedido de Venda</p>
        <div className="text-right text-[10px]">
          <p>Pedido Nº: <strong>{pedido.idPedidoWeb}</strong></p>
          <p>Data: <strong>{fmtData(pedido.dtPedido)}</strong></p>
        </div>
      </div>

      {/* ── Dados do cliente ── */}
      <div className="border border-gray-400 p-2 mb-2">
        <p className="font-bold uppercase text-[10px] border-b border-gray-300 mb-1.5 pb-0.5">Dados do Cliente</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div><span className="text-gray-500">Cliente: </span><strong>{pedido.nmCliente}</strong></div>
          <div><span className="text-gray-500">CPF/CNPJ: </span><strong>{fmtCpfCnpj(pedido.nrCpfCnpj)}</strong></div>
          {pedido.dsTelefone && (
            <div><span className="text-gray-500">Fone: </span><strong>{pedido.dsTelefone}</strong></div>
          )}
          {pedido.dsEmail && (
            <div><span className="text-gray-500">E-mail: </span><strong>{pedido.dsEmail}</strong></div>
          )}
          {pedido.dsCidade && (
            <div><span className="text-gray-500">Cidade/UF: </span><strong>{pedido.dsCidade}/{pedido.dsUf}</strong></div>
          )}
          {pedido.dsCep && (
            <div><span className="text-gray-500">CEP: </span><strong>{pedido.dsCep}</strong></div>
          )}
          {pedido.dsEndereco && (
            <div className="col-span-2"><span className="text-gray-500">Endereço: </span><strong>{pedido.dsEndereco}{pedido.dsNumero ? `, ${pedido.dsNumero}` : ''}</strong></div>
          )}
        </div>
      </div>

      {/* ── Produtos ── */}
      <div className="border border-gray-400 p-2 mb-2">
        <p className="font-bold uppercase text-[10px] border-b border-gray-300 mb-1.5 pb-0.5">Produtos</p>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left pb-1 w-10">Qtd</th>
              <th className="text-left pb-1 w-12">Un.</th>
              <th className="text-left pb-1">Descrição</th>
              <th className="text-right pb-1 w-24">Preço Unit.</th>
              <th className="text-right pb-1 w-24">SubTotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.itens.map((item, i) => (
              <tr key={item.idItem} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                <td className="py-0.5">{item.qtItem}</td>
                <td className="py-0.5">{item.dsUnidade}</td>
                <td className="py-0.5">{item.dsProduto}</td>
                <td className="py-0.5 text-right">{fmtMoeda(item.vlUnitario)}</td>
                <td className="py-0.5 text-right">{fmtMoeda(item.vlTotalItem)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td colSpan={4} className="pt-1 text-right font-bold">Total Produtos</td>
              <td className="pt-1 text-right font-bold">{fmtMoeda(pedido.vlSubtotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Forma de Pagamento ── */}
      <div className="border border-gray-400 px-2 py-1.5 mb-2">
        <span className="font-bold text-[10px]">Forma de Pagamento: </span>
        <span>{pedido.dsCondicaoPagamento ?? '—'}</span>
        {pedido.qtdParcelas && pedido.qtdParcelas > 1 && (
          <span> — {pedido.qtdParcelas}x</span>
        )}
      </div>

      {/* ── Totais ── */}
      <div className="border border-gray-400 p-2 mb-3">
        <div className="flex justify-end gap-8">
          <div className="space-y-0.5 text-right text-[10px]">
            <div className="flex justify-between gap-8">
              <span className="text-gray-500">Valor Frete:</span>
              <span>{fmtMoeda(pedido.vlFrete)}</span>
            </div>
            {pedido.vlDesconto > 0 && (
              <div className="flex justify-between gap-8">
                <span className="text-gray-500">Desconto Geral:</span>
                <span className="text-red-600">- {fmtMoeda(pedido.vlDesconto)}</span>
              </div>
            )}
            <div className="flex justify-between gap-8 border-t border-gray-300 pt-0.5 font-bold text-[12px]">
              <span>Valor Total:</span>
              <span>{fmtMoeda(pedido.vlTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Observação ── */}
      {pedido.dsObservacao && (
        <div className="mb-3">
          <p className="text-[10px] font-bold">Observação:</p>
          <p className="border border-gray-300 px-2 py-1 mt-0.5 text-[10px]">{pedido.dsObservacao}</p>
        </div>
      )}

      {/* ── Declaração ── */}
      <div className="text-[9px] text-gray-500 text-center mb-4 italic">
        Estamos de total acordo com os itens acima discriminados, pelo qual pagarei o valor integral e total nas datas acima.
      </div>

      {/* ── Assinaturas ── */}
      <div className="flex justify-between gap-8 mt-2">
        <div className="flex-1 text-center">
          <div className="border-t border-gray-500 pt-1">
            <p className="text-[10px]">Assinatura do Vendedor</p>
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="border-t border-gray-500 pt-1">
            <p className="text-[10px]">Assinatura do Cliente</p>
          </div>
        </div>
      </div>

      {/* ── Campo observação extra ── */}
      <div className="mt-4">
        <p className="text-[10px] font-bold">Observação:</p>
        <div className="border-b border-gray-300 mt-4" />
        <div className="border-b border-gray-300 mt-3" />
      </div>
    </div>
  )
}
