import { useState, useEffect } from 'react'
import { Search, ArrowLeft, Camera, Printer, RefreshCw } from 'lucide-react'

const NAVY = '#13293D'
const TEAL = '#3E7080'

interface SessaoResumo {
  sessao: string
  savedAt: string | null
  fotos: number
  veiculo: { placa: string; marca: string; modelo: string; km: number } | null
  motorista: string | null
}

interface ChecklistCompleto {
  veiculo?: { placa?: string; marca?: string; modelo?: string; km?: string; descricao?: string }
  motorista?: { nome?: string; fone?: string }
  data?: string
  responsavel?: string
  _meta?: { savedAt?: string; fotos?: string[]; sessao?: string; placa?: string }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function HistoricoPage({ onVoltar }: { onVoltar: () => void }) {
  const [placa, setPlaca]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')
  const [lista, setLista]       = useState<SessaoResumo[]>([])
  const [placaBuscada, setPlacaBuscada] = useState('')

  // Detalhes de sessão selecionada
  const [sessaoSel, setSessaoSel] = useState<string | null>(null)
  const [detalhes, setDetalhes]   = useState<ChecklistCompleto | null>(null)
  const [fotosUrls, setFotosUrls] = useState<string[]>([])
  const [loadDet, setLoadDet]     = useState(false)
  const [printComFotos, setPrintComFotos] = useState(true)

  const buscar = async () => {
    const p = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!p) return
    setLoading(true); setErro(''); setLista([]); setSessaoSel(null); setDetalhes(null)
    try {
      const res  = await fetch(`/api/vistoria/historico/${p}`)
      const json = await res.json()
      if (!json.ok) { setErro(json.erro || 'Nenhum registro encontrado.'); return }
      setLista(json.lista || [])
      setPlacaBuscada(p)
      if ((json.lista || []).length === 0) setErro('Nenhuma vistoria salva para esta placa.')
    } catch { setErro('Erro ao conectar com a API.') }
    finally { setLoading(false) }
  }

  const abrirSessao = async (sessao: string) => {
    setSessaoSel(sessao); setLoadDet(true); setDetalhes(null); setFotosUrls([])
    try {
      const res  = await fetch(`/api/vistoria/${placaBuscada}/${sessao}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.erro)
      setDetalhes(json.checklist)
      setFotosUrls(json.fotosUrls || [])
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar vistoria.')
      setSessaoSel(null)
    } finally { setLoadDet(false) }
  }

  const handleImprimir = () => {
    if (!printComFotos) {
      // esconde as fotos antes de imprimir
      document.querySelectorAll<HTMLElement>('.hist-fotos-section').forEach(el => {
        el.style.display = 'none'
      })
    }
    window.print()
    if (!printComFotos) {
      document.querySelectorAll<HTMLElement>('.hist-fotos-section').forEach(el => {
        el.style.display = ''
      })
    }
  }

  useEffect(() => {
    document.title = sessaoSel ? `Vistoria ${placaBuscada}` : 'Histórico de Vistorias'
  }, [sessaoSel, placaBuscada])

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; margin: 0; }
          @page { size: A4 portrait; margin: 8mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        background: NAVY, color: '#fff', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <img src="/logo-seven.png" alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
        <button onClick={onVoltar}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={14} /> Voltar ao Checklist
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Histórico de Vistorias</span>

        <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && buscar()}
          placeholder="Placa..." maxLength={8}
          style={{ border: '1px solid #3E7080', borderRadius: 6, padding: '0 12px', height: 36,
            fontSize: 13, letterSpacing: 3, background: '#1e3a52', color: '#fff',
            outline: 'none', width: 120 }} />
        <button onClick={buscar} disabled={loading}
          style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 6,
            padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
          <Search size={14} />{loading ? 'Buscando…' : 'Buscar'}
        </button>

        {sessaoSel && detalhes && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {fotosUrls.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: '#9ca3af', cursor: 'pointer' }}>
                <input type="checkbox" checked={printComFotos}
                  onChange={e => setPrintComFotos(e.target.checked)}
                  style={{ accentColor: TEAL }} />
                Com fotos
              </label>
            )}
            <button onClick={handleImprimir}
              style={{ background: '#fff', color: NAVY, border: 'none',
                borderRadius: 6, padding: '0 18px', height: 36, cursor: 'pointer', fontSize: 13,
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Printer size={14} /> Imprimir / PDF
            </button>
          </div>
        )}
      </div>

      {erro && (
        <div className="no-print" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 20px', fontSize: 13 }}>
          {erro}
        </div>
      )}

      <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>

        {/* ── Lista de sessões ── */}
        {!sessaoSel && lista.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 10 }}>
              {lista.length} vistoria{lista.length > 1 ? 's' : ''} encontrada{lista.length > 1 ? 's' : ''} para {placaBuscada}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {lista.map(s => (
                <button key={s.sessao} onClick={() => abrirSessao(s.sessao)}
                  style={{ textAlign: 'left', background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: NAVY, minWidth: 90 }}>
                    {s.savedAt ? new Date(s.savedAt).toLocaleDateString('pt-BR') : '—'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>
                      {s.veiculo?.placa || placaBuscada}
                      {s.veiculo?.marca ? ` — ${s.veiculo.marca} ${s.veiculo.modelo || ''}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {fmtDate(s.savedAt)}
                      {s.motorista ? ` · ${s.motorista}` : ''}
                    </div>
                  </div>
                  {s.fotos > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: TEAL,
                      background: '#f0f9ff', borderRadius: 20, padding: '3px 10px' }}>
                      <Camera size={12} /> {s.fotos} foto{s.fotos > 1 ? 's' : ''}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>Ver →</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Detalhe da sessão ── */}
        {sessaoSel && (
          <div>
            {/* Voltar para a lista */}
            <button className="no-print" onClick={() => { setSessaoSel(null); setDetalhes(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                color: TEAL, background: 'none', border: 'none', cursor: 'pointer',
                marginBottom: 14, fontWeight: 600 }}>
              <ArrowLeft size={14} /> Voltar à lista
            </button>

            {loadDet && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}>
                <RefreshCw size={14} className="animate-spin" /> Carregando vistoria…
              </div>
            )}

            {detalhes && (
              <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

                {/* Cabeçalho */}
                <div style={{ borderBottom: `3px solid ${NAVY}`, paddingBottom: 12, marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, letterSpacing: 1 }}>
                      CHECK-LIST DE VEÍCULO
                    </div>
                    <div style={{ fontSize: 11, color: TEAL, marginTop: 2 }}>
                      Salvo em {fmtDate(detalhes._meta?.savedAt)}
                    </div>
                  </div>
                  {detalhes.veiculo?.placa && (
                    <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, letterSpacing: 3,
                      border: `2px solid ${TEAL}`, borderRadius: 6, padding: '4px 10px' }}>
                      {detalhes.veiculo.placa}
                    </div>
                  )}
                </div>

                {/* Dados do veículo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 20px', marginBottom: 16 }}>
                  {[
                    ['Marca', detalhes.veiculo?.marca],
                    ['Modelo', detalhes.veiculo?.modelo],
                    ['Placa', detalhes.veiculo?.placa],
                    ['KM', detalhes.veiculo?.km],
                    ['Descrição / Cor', detalhes.veiculo?.descricao],
                    ['Data da Vistoria', detalhes.data ? new Date(detalhes.data + 'T12:00:00').toLocaleDateString('pt-BR') : '—'],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 13, color: NAVY, fontWeight: 600, borderBottom: `1px solid ${TEAL}`, paddingBottom: 2 }}>
                        {val || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Dados do motorista */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 20px', marginBottom: 16 }}>
                  {[
                    ['Motorista', detalhes.motorista?.nome],
                    ['Fone', detalhes.motorista?.fone],
                    ['Responsável', detalhes.responsavel],
                  ].map(([label, val]) => (
                    <div key={label as string}>
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
                      <div style={{ fontSize: 13, color: NAVY, fontWeight: 600, borderBottom: `1px solid ${TEAL}`, paddingBottom: 2 }}>
                        {val || '—'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Fotos */}
                {fotosUrls.length > 0 && (
                  <div className="hist-fotos-section" style={{ marginTop: 16 }}>
                    <div style={{ background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700,
                      letterSpacing: 1, padding: '4px 10px', marginBottom: 12, borderRadius: 4 }}>
                      FOTOS DA VISTORIA ({fotosUrls.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {fotosUrls.map((url, i) => (
                        <div key={i}>
                          <img src={url} alt={`Foto ${i + 1}`}
                            style={{ width: 200, height: 150, objectFit: 'cover', borderRadius: 6,
                              border: '1px solid #d1d5db', display: 'block', cursor: 'pointer' }}
                            onClick={() => window.open(url, '_blank')}
                          />
                          <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>Foto {i + 1}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Estado inicial */}
        {!loading && lista.length === 0 && !erro && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#9ca3af' }}>
            <Camera size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>Digite uma placa e clique em Buscar</div>
          </div>
        )}
      </div>
    </div>
  )
}
