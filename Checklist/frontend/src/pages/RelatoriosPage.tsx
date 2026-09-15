import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Search, RefreshCw } from 'lucide-react'

const NAVY = '#13293D'
const TEAL = '#3E7080'

type RelatorioTipo = 'servicos' | 'pecas'

interface Vendedor {
  id: number
  nome: string
}

interface ClienteSugestao {
  id: number
  nome: string
}

interface LinhaRelatorio {
  vendedor: string
  cliente: string
  item: string
  numeroNota: string
  dataEmissao: string
  valorVenda: number
  valorTotal: number
  comissao: number | null
}

interface Totais {
  valorVenda: number
  valorTotal: number
  comissao: number | null
}

function primeiroDiaMes(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function ultimoDiaMes(): string {
  const d = new Date()
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return ultimo.toISOString().slice(0, 10)
}

function fmtMoeda(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

const ROTULO_ITEM: Record<RelatorioTipo, string> = {
  servicos: 'Serviço',
  pecas: 'Peça',
}

const inputStyle: CSSProperties = {
  border: '1px solid #3E7080', borderRadius: 6, padding: '0 10px', height: 34,
  fontSize: 13, background: '#1e3a52', color: '#fff', outline: 'none',
}

export default function RelatoriosPage({ onVoltar }: { onVoltar: () => void }) {
  const [relatorioAtivo, setRelatorioAtivo] = useState<RelatorioTipo>('servicos')

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes())
  const [dataFim, setDataFim]       = useState(ultimoDiaMes())

  const [vendedores, setVendedores]   = useState<Vendedor[]>([])
  const [vendedorId, setVendedorId]   = useState('')

  const [clienteQuery, setClienteQuery]         = useState('')
  const [clienteId, setClienteId]               = useState<number | null>(null)
  const [sugestoesCliente, setSugestoesCliente] = useState<ClienteSugestao[]>([])

  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([])
  const [totais, setTotais] = useState<Totais | null>(null)
  const [limitado, setLimitado] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')
  const [buscou, setBuscou]     = useState(false)

  // Carrega vendedores uma vez
  useEffect(() => {
    fetch('/api/relatorio/vendedores')
      .then(res => res.json())
      .then(json => { if (json.ok) setVendedores(json.vendedores || []) })
      .catch(() => {})
  }, [])

  // Autocomplete de cliente com debounce
  useEffect(() => {
    if (clienteId !== null || clienteQuery.trim().length < 2) {
      setSugestoesCliente([])
      return
    }
    const timeout = setTimeout(() => {
      fetch(`/api/checklist/cliente/buscar?q=${encodeURIComponent(clienteQuery.trim())}`)
        .then(res => res.json())
        .then(json => { if (json.ok) setSugestoesCliente(json.clientes || []) })
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timeout)
  }, [clienteQuery, clienteId])

  function selecionarCliente(c: ClienteSugestao) {
    setClienteId(c.id)
    setClienteQuery(c.nome)
    setSugestoesCliente([])
  }

  function limparCliente() {
    setClienteId(null)
    setClienteQuery('')
  }

  function trocarAba(aba: RelatorioTipo) {
    setRelatorioAtivo(aba)
    setLinhas([])
    setTotais(null)
    setErro('')
    setBuscou(false)
  }

  async function buscar() {
    setLoading(true); setErro(''); setBuscou(true)
    try {
      const params = new URLSearchParams({ dataInicio, dataFim })
      if (vendedorId) params.set('vendedorId', vendedorId)
      if (clienteId !== null) params.set('clienteId', String(clienteId))

      const endpoint = relatorioAtivo === 'servicos' ? 'comissao-servicos' : 'comissao-pecas'
      const res  = await fetch(`/api/relatorio/${endpoint}?${params.toString()}`)
      const json = await res.json()

      if (!json.ok) { setErro(json.erro || 'Erro ao gerar relatório.'); setLinhas([]); setTotais(null); return }

      setLinhas(json.linhas || [])
      setTotais(json.totais || null)
      setLimitado(!!json.limitado)
    } catch {
      setErro('Erro ao conectar com a API.')
    } finally {
      setLoading(false)
    }
  }

  const rotuloItem = ROTULO_ITEM[relatorioAtivo]
  const comissaoPendente = buscou && linhas.length > 0 && totais?.comissao === null

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, sans-serif' }}>
      {/* Toolbar */}
      <div style={{
        background: NAVY, color: '#fff', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}>
        <img src="/logo-seven.png" alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
        <button onClick={onVoltar}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Voltar ao Checklist
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Relatórios</span>

        <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
          <button onClick={() => trocarAba('servicos')}
            style={{
              background: relatorioAtivo === 'servicos' ? TEAL : 'transparent',
              color: '#fff', border: '1px solid #3E7080', borderRadius: 20,
              padding: '0 16px', height: 32, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
            Comissão — Serviços
          </button>
          <button onClick={() => trocarAba('pecas')}
            style={{
              background: relatorioAtivo === 'pecas' ? TEAL : 'transparent',
              color: '#fff', border: '1px solid #3E7080', borderRadius: 20,
              padding: '0 16px', height: 32, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
            Comissão — Peças
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        background: '#1e3a52', padding: '12px 20px', display: 'flex',
        alignItems: 'flex-end', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#9ca3af' }}>De</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#9ca3af' }}>Até</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#9ca3af' }}>Vendedor</label>
          <select value={vendedorId} onChange={e => setVendedorId(e.target.value)}
            style={{ ...inputStyle, minWidth: 160 }}>
            <option value="">Todos</option>
            {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <label style={{ fontSize: 11, color: '#9ca3af' }}>Cliente</label>
          <input value={clienteQuery}
            onChange={e => { setClienteQuery(e.target.value); setClienteId(null) }}
            placeholder="Buscar cliente..." style={{ ...inputStyle, minWidth: 200 }} />
          {clienteId !== null && (
            <button onClick={limparCliente}
              style={{ position: 'absolute', right: 6, top: 24, background: 'transparent',
                color: '#9ca3af', border: 'none', cursor: 'pointer', fontSize: 13 }}>
              ×
            </button>
          )}
          {sugestoesCliente.length > 0 && (
            <div style={{ position: 'absolute', top: 58, left: 0, right: 0, background: '#fff',
              borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 20, maxHeight: 200, overflowY: 'auto' }}>
              {sugestoesCliente.map(c => (
                <div key={c.id} onClick={() => selecionarCliente(c)}
                  style={{ padding: '8px 12px', fontSize: 13, color: NAVY, cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                  {c.nome}
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={buscar} disabled={loading}
          style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 6,
            padding: '0 18px', height: 34, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </div>

      {erro && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 20px', fontSize: 13 }}>
          {erro}
        </div>
      )}

      {comissaoPendente && (
        <div style={{ background: '#fef3c7', color: '#92400e', padding: '8px 20px', fontSize: 13 }}>
          Cálculo de comissão pendente de confirmação de schema — os demais dados já estão disponíveis.
        </div>
      )}

      {limitado && (
        <div style={{ background: '#dbeafe', color: '#1e40af', padding: '8px 20px', fontSize: 13 }}>
          Resultado limitado a 2000 linhas — refine o período para ver tudo.
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>
        {buscou && linhas.length === 0 && !loading && !erro && (
          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: 40 }}>
            Nenhum resultado para os filtros selecionados.
          </div>
        )}

        {linhas.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: NAVY, color: '#fff' }}>
                    <th style={thStyle}>Vendedor</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={thStyle}>{rotuloItem}</th>
                    <th style={thStyle}>Nota</th>
                    <th style={thStyle}>Data</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Valor Venda</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Valor Total</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={tdStyle}>{l.vendedor || '—'}</td>
                      <td style={tdStyle}>{l.cliente || '—'}</td>
                      <td style={tdStyle}>{l.item || '—'}</td>
                      <td style={tdStyle}>{l.numeroNota || '—'}</td>
                      <td style={tdStyle}>{fmtData(l.dataEmissao)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(l.valorVenda)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(l.valorTotal)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(l.comissao)}</td>
                    </tr>
                  ))}
                </tbody>
                {totais && (
                  <tfoot>
                    <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                      <td style={tdStyle} colSpan={5}>Total ({linhas.length} linha{linhas.length > 1 ? 's' : ''})</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(totais.valorVenda)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(totais.valorTotal)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtMoeda(totais.comissao)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const thStyle: CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700,
}

const tdStyle: CSSProperties = {
  padding: '8px 12px', color: NAVY,
}
