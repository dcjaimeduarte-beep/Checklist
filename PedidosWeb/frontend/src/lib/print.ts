import type { PedidoDetalhe } from '@/types/pedido'
import type { EmpresaInfo } from '@/lib/api'

function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : String(v)
  if (s.includes('=>') && s.includes('callback') && s.length > 100) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s: string): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return d ? `${d}/${m}/${y}` : s
}
function fmtCnpj(v = ''): string {
  const n = v.replace(/\D/g, '')
  if (n.length === 14) return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (n.length === 11) return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  return v
}
function fmtFone(v = ''): string {
  const n = v.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return v
}

function abrirJanela(html: string, largura: number, altura: number) {
  const left = Math.max(0, Math.round((screen.width - largura) / 2))
  const top = Math.max(0, Math.round((screen.height - altura) / 2))
  const win = window.open('', '_blank', `width=${largura},height=${altura},left=${left},top=${top},resizable=yes,scrollbars=yes`)
  if (!win) return
  win.document.write(html)
  win.document.close()
}

/* ─────────────────────────────────────────────────
   LAYOUT A4 — Pedido de Venda clássico
───────────────────────────────────────────────── */
export function imprimirPedido(pedido: PedidoDetalhe, empresa: EmpresaInfo): void {
  const itensHtml = pedido.itens.map((item, i) => `
    <tr style="background:${i % 2 === 1 ? '#f9f9f9' : '#fff'}">
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">${esc(item.qtItem)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:center">${esc(item.dsUnidade)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee">${esc(item.dsProduto)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right">${fmtMoeda(item.vlUnitario)}</td>
      <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${fmtMoeda(item.vlTotalItem)}</td>
    </tr>
  `).join('')

  const obsTexto = esc(pedido.dsObservacao ?? '')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Pedido #${pedido.idPedidoWeb} — ${esc(empresa.nmFantasia)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px 28px; }
    .page { max-width: 680px; margin: 0 auto; }
    .header { border: 1px solid #999; padding: 10px 12px; margin-bottom: 6px; }
    .header-name { font-size: 16px; font-weight: bold; text-transform: uppercase; text-align: center; }
    .header-razao { font-size: 9px; color: #555; text-align: center; margin-bottom: 6px; }
    .header-info { display: flex; justify-content: space-between; border-top: 1px solid #ccc; padding-top: 5px; font-size: 9px; color: #444; }
    .titulo { border: 1px solid #999; padding: 6px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
    .titulo-label { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .titulo-info { text-align: right; font-size: 10px; }
    .titulo-info strong { font-size: 12px; }
    .section { border: 1px solid #999; padding: 8px 12px; margin-bottom: 6px; }
    .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #444; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
    .cliente-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .campo label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: .5px; display: block; }
    .campo span { font-weight: 600; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f2f2f2; padding: 5px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #555; border-bottom: 2px solid #ccc; }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    tfoot td { padding: 5px 6px; font-weight: bold; }
    .pagamento { border: 1px solid #999; padding: 6px 12px; margin-bottom: 6px; font-size: 10px; }
    .pagamento label { font-size: 9px; text-transform: uppercase; color: #777; letter-spacing: .5px; }
    .pagamento span { font-weight: 600; font-size: 11px; }
    .declaracao { font-size: 9px; color: #666; text-align: center; margin: 10px 0; font-style: italic; }
    .assinaturas { display: flex; gap: 40px; margin-top: 20px; }
    .assinatura { flex: 1; text-align: center; }
    .assinatura .linha { border-top: 1px solid #333; padding-top: 4px; font-size: 9px; color: #555; margin-top: 28px; }
    .obs { margin-top: 14px; font-size: 9px; }
    .obs label { font-weight: bold; text-transform: uppercase; letter-spacing: .5px; }
    .obs-linhas div { border-bottom: 1px solid #ccc; margin-top: 10px; }
    @media print { body { padding: 10px 14px; } @page { margin: 10mm; } }
  </style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-name">${esc(empresa.nmFantasia || empresa.nmRazaoSocial)}</div>
    <div class="header-razao">${esc(empresa.nmRazaoSocial)}</div>
    <div class="header-info">
      <span>CNPJ: <strong>${fmtCnpj(empresa.dsCnpj)}</strong></span>
      <span>Insc. Est.: <strong>${esc(empresa.dsInscEstadual)}</strong></span>
      <span>${esc(empresa.dsEndereco)}, ${esc(empresa.dsNumero)} — ${esc(empresa.dsMunicipio)}/${esc(empresa.dsUf)}</span>
      <span>Fone: <strong>${fmtFone(empresa.dsTelefone)}</strong></span>
    </div>
  </div>

  <div class="titulo">
    <span class="titulo-label">Pedido de Venda</span>
    <div class="titulo-info">
      <div>Nº <strong>${pedido.idPedidoWeb}</strong></div>
      <div>Data: <strong>${fmtData(pedido.dtPedido)}</strong></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="cliente-grid">
      <div class="campo"><label>Nome / Razão Social</label><span>${esc(pedido.nmCliente)}</span></div>
      <div class="campo"><label>CPF / CNPJ</label><span>${fmtCnpj(pedido.nrCpfCnpj ?? '')}</span></div>
      ${pedido.dsTelefone ? `<div class="campo"><label>Telefone</label><span>${esc(pedido.dsTelefone)}</span></div>` : ''}
      ${pedido.dsEmail ? `<div class="campo"><label>E-mail</label><span>${esc(pedido.dsEmail)}</span></div>` : ''}
      ${pedido.dsCidade ? `<div class="campo"><label>Cidade / UF</label><span>${esc(pedido.dsCidade)} / ${esc(pedido.dsUf)}</span></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Produtos</div>
    <table>
      <thead>
        <tr>
          <th class="center" style="width:40px">Qtd</th>
          <th class="center" style="width:50px">Un.</th>
          <th>Descrição</th>
          <th class="right" style="width:90px">Preço Unit.</th>
          <th class="right" style="width:90px">SubTotal</th>
        </tr>
      </thead>
      <tbody>${itensHtml}</tbody>
      <tfoot>
        ${pedido.vlDesconto > 0 ? `
        <tr>
          <td colspan="4" style="text-align:right;padding:4px 6px;color:#666">Desconto:</td>
          <td style="text-align:right;padding:4px 6px;color:#c00">- ${fmtMoeda(pedido.vlDesconto)}</td>
        </tr>` : ''}
        <tr style="border-top:2px solid #ccc">
          <td colspan="4" style="text-align:right;padding:6px 6px 2px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;font-size:9px">Total Produtos</td>
          <td style="text-align:right;padding:6px 6px 2px;font-weight:bold;font-size:13px">${fmtMoeda(pedido.vlTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:6px">
    <div class="pagamento" style="flex:1">
      <label>Forma de Pagamento</label><br/>
      <span>${esc(pedido.dsCondicaoPagamento ?? '—')}${pedido.qtdParcelas && pedido.qtdParcelas > 1 ? ` — ${pedido.qtdParcelas}x` : ''}</span>
    </div>
    <div class="section" style="width:220px;margin-bottom:0">
      <table style="width:100%;font-size:10px">
        <tbody>
          <tr><td style="color:#666">Valor Frete:</td><td style="text-align:right">${fmtMoeda(pedido.vlFrete ?? 0)}</td></tr>
          ${pedido.vlDesconto > 0 ? `<tr><td style="color:#666">Desconto Geral:</td><td style="text-align:right;color:#c00">- ${fmtMoeda(pedido.vlDesconto)}</td></tr>` : ''}
          <tr style="border-top:1px solid #ccc"><td style="font-weight:bold;padding-top:4px">Valor Total:</td><td style="text-align:right;font-weight:bold;padding-top:4px;font-size:13px">${fmtMoeda(pedido.vlTotal)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  ${obsTexto ? `
  <div class="section" style="margin-bottom:6px">
    <div class="section-title">Observação</div>
    <p style="font-size:10px">${obsTexto}</p>
  </div>` : ''}

  <div class="declaracao">
    Estamos de total acordo com os itens acima discriminados, pelo qual pagarei o valor integral e total nas datas acima.
  </div>

  <div class="assinaturas">
    <div class="assinatura"><div class="linha">Assinatura do Vendedor</div></div>
    <div class="assinatura"><div class="linha">Assinatura do Cliente</div></div>
  </div>

  <div class="obs">
    <label>Observação:</label>
    <div class="obs-linhas"><div/><div/></div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()}},250)}</script>
</body>
</html>`

  abrirJanela(html, 820, 1100)
}

/* ─────────────────────────────────────────────────
   LAYOUT CUPOM — 80mm estilo térmica
───────────────────────────────────────────────── */
export function imprimirCupom(pedido: PedidoDetalhe, empresa: EmpresaInfo): void {
  const SEP  = '--------------------------------'
  const SEP2 = '================================'

  const itensHtml = pedido.itens.map((item) => `
    <tr>
      <td style="padding:2px 0;vertical-align:top;white-space:nowrap">${esc(item.qtItem)} ${esc(item.dsUnidade)}</td>
      <td style="padding:2px 4px;vertical-align:top">${esc(item.dsProduto)}</td>
      <td style="padding:2px 0;vertical-align:top;text-align:right;white-space:nowrap">${fmtMoeda(item.vlTotalItem)}</td>
    </tr>
    <tr>
      <td></td>
      <td style="color:#555;font-size:9px;padding-bottom:3px">${fmtMoeda(item.vlUnitario)} × ${esc(item.qtItem)}</td>
      <td></td>
    </tr>
  `).join('')

  const obsTexto = esc(pedido.dsObservacao ?? '')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Cupom #${pedido.idPedidoWeb}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; background: #fff; width: 302px; padding: 8px 6px; }
    .c { text-align: center; }
    .b { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .rodape { font-size: 9px; color: #555; text-align: center; margin-top: 4px; }
    @media print { body { width: 80mm; } @page { margin: 2mm; size: 80mm auto; } }
  </style>
</head>
<body>
  <div class="c b" style="font-size:13px;text-transform:uppercase">${esc(empresa.nmFantasia || empresa.nmRazaoSocial)}</div>
  <div class="c" style="font-size:9px">${esc(empresa.nmRazaoSocial)}</div>
  <div class="c" style="font-size:9px">CNPJ: ${fmtCnpj(empresa.dsCnpj)}</div>
  <div class="c" style="font-size:9px">${esc(empresa.dsEndereco)}, ${esc(empresa.dsNumero)}</div>
  <div class="c" style="font-size:9px">${esc(empresa.dsMunicipio)}/${esc(empresa.dsUf)} — ${fmtFone(empresa.dsTelefone)}</div>

  <div class="c" style="margin:4px 0">${SEP2}</div>
  <div class="c b" style="font-size:12px">PEDIDO DE VENDA</div>
  <div class="c" style="font-size:10px">Nº ${pedido.idPedidoWeb} — ${fmtData(pedido.dtPedido)}</div>
  <div class="c" style="margin:4px 0">${SEP2}</div>

  <div class="b" style="font-size:10px">${esc(pedido.nmCliente)}</div>
  <div style="font-size:9px">CPF/CNPJ: ${fmtCnpj(pedido.nrCpfCnpj ?? '')}</div>
  ${pedido.dsTelefone ? `<div style="font-size:9px">Fone: ${esc(pedido.dsTelefone)}</div>` : ''}

  <div class="c" style="margin:4px 0;font-size:10px">${SEP}</div>
  <div style="font-size:9px" class="b">QTD  PRODUTO                  VLR</div>
  <div class="c" style="margin:2px 0;font-size:10px">${SEP}</div>

  <table><tbody>${itensHtml}</tbody></table>

  <div class="c" style="margin:4px 0;font-size:10px">${SEP}</div>
  ${pedido.vlDesconto > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px"><span>Desconto:</span><span>- ${fmtMoeda(pedido.vlDesconto)}</span></div>` : ''}
  ${(pedido.vlFrete ?? 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:10px"><span>Frete:</span><span>${fmtMoeda(pedido.vlFrete)}</span></div>` : ''}
  <div class="c" style="margin:4px 0">${SEP2}</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <span class="b" style="font-size:12px">TOTAL:</span>
    <span class="b" style="font-size:16px">${fmtMoeda(pedido.vlTotal)}</span>
  </div>
  <div class="c" style="margin:4px 0">${SEP2}</div>

  <div style="font-size:10px;margin-top:2px"><span class="b">Pagamento: </span>${esc(pedido.dsCondicaoPagamento ?? '—')}${pedido.qtdParcelas && pedido.qtdParcelas > 1 ? ` (${pedido.qtdParcelas}x)` : ''}</div>

  ${obsTexto ? `<div class="c" style="margin:4px 0;font-size:10px">${SEP}</div><div style="font-size:9px"><span class="b">OBS: </span>${obsTexto}</div>` : ''}

  <div class="c" style="margin:6px 0">${SEP2}</div>
  <div class="rodape">Obrigado pela preferência!</div>
  <br/><br/>
<script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.close()}},250)}</script>
</body>
</html>`

  abrirJanela(html, 750, 700)
}
