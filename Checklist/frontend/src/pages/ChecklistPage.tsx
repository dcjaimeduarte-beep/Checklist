import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Printer, RotateCcw, Upload } from 'lucide-react'

// ─── Seven brand colors ───────────────────────────────────────────────────────
const NAVY  = '#13293D'
const TEAL  = '#3E7080'

// ─── Types ───────────────────────────────────────────────────────────────────
type ItemStatus = 'na' | 'bom' | 'ruim' | 'nf'
type AvariaStatus = 'ok' | 'A' | 'R' | 'X' | 'F'

interface VeiculoInfo {
  id: number; placa: string; descricao: string; marca: string; modelo: string; km: number
  cliente: { id: number; nome: string; telefone: string; celular: string }
}

// ─── Status configs ───────────────────────────────────────────────────────────
const ITEM_CFG: Record<ItemStatus, { label: string; short: string; bg: string; color: string }> = {
  na:  { label: 'N/A',    short: '—',  bg: '#f3f4f6', color: '#9ca3af' },
  bom: { label: 'BOM',    short: 'B',  bg: '#16a34a', color: '#fff'    },
  ruim:{ label: 'RUIM',   short: 'R',  bg: '#dc2626', color: '#fff'    },
  nf:  { label: 'N.FUNC', short: 'NF', bg: '#374151', color: '#fff'    },
}
const ITEM_ORDER: ItemStatus[] = ['bom', 'ruim', 'nf']

const AVARIA_CFG: Record<AvariaStatus, { label: string; fill: string; stroke: string }> = {
  ok: { label: 'Sem avaria', fill: '#dcfce7', stroke: '#86efac' },
  A:  { label: 'Amassado',   fill: '#fed7aa', stroke: '#fb923c' },
  R:  { label: 'Riscado',    fill: '#fef08a', stroke: '#facc15' },
  X:  { label: 'Quebrado',   fill: '#fca5a5', stroke: '#f87171' },
  F:  { label: 'Faltante',   fill: '#ddd6fe', stroke: '#a78bfa' },
}
const AVARIA_ORDER: AvariaStatus[] = ['ok', 'A', 'R', 'X', 'F']

// ─── Items ────────────────────────────────────────────────────────────────────
const INSP_LEFT = [
  { id: 'farois',      label: 'Faróis / Lâmpadas / Piscas' },
  { id: 'estepe',      label: 'Estepe / Chave de Roda' },
  { id: 'macaco',      label: 'Macaco / Triângulo' },
  { id: 'limpador',    label: 'Limpador e Lavador de Para-brisa' },
  { id: 'extintor',    label: 'Extintor' },
  { id: 'buzina',      label: 'Buzina' },
  { id: 'pneus_diant', label: 'Pneus Dianteiros' },
  { id: 'pneus_tras',  label: 'Pneus Traseiros' },
  { id: 'calotas',     label: 'Calotas / Rodas' },
  { id: 'freios',      label: 'Freios (Pé e Mão)' },
]
const INSP_RIGHT = [
  { id: 'cinto',        label: 'Cinto de Segurança' },
  { id: 'painel',       label: 'Indicadores de Painel' },
  { id: 'oleo',         label: 'Óleo Motor (Nível)' },
  { id: 'fluido_freio', label: 'Fluído de Freio (Nível)' },
  { id: 'arrefec',      label: 'Líq. Arrefecimento (Nível)' },
  { id: 'partida',      label: 'Motor de Partida' },
  { id: 'janelas',      label: 'Fechamento das Janelas' },
  { id: 'tapetes',      label: 'Tapetes' },
  { id: 'antena',       label: 'Antena e Tampão Traseiro' },
  { id: 'outro',        label: 'Outro' },
]

const BODY_PARTS = [
  { id: 'pch_diant', label: 'P.Ch. Diant.' },
  { id: 'par_de',    label: 'Par.D.Esq' },
  { id: 'capo',      label: 'Capô' },
  { id: 'par_dd',    label: 'Par.D.Dir' },
  { id: 'ret_esq',   label: 'Ret.Esq' },
  { id: 'ret_dir',   label: 'Ret.Dir' },
  { id: 'por_de',    label: 'Porta D.Esq' },
  { id: 'por_dd',    label: 'Porta D.Dir' },
  { id: 'teto',      label: 'Teto' },
  { id: 'por_te',    label: 'Porta T.Esq' },
  { id: 'por_td',    label: 'Porta T.Dir' },
  { id: 'par_te',    label: 'Par.T.Esq' },
  { id: 'tampa',     label: 'Tampa Tras.' },
  { id: 'par_td',    label: 'Par.T.Dir' },
  { id: 'pch_tras',  label: 'P.Ch. Tras.' },
  { id: 'vid_parab', label: 'Parabrisa' },
  { id: 'vid_tras',  label: 'Vid.Traseiro' },
  { id: 'rod_de',    label: 'Roda D.Esq' },
  { id: 'rod_dd',    label: 'Roda D.Dir' },
  { id: 'rod_te',    label: 'Roda T.Esq' },
  { id: 'rod_td',    label: 'Roda T.Dir' },
]

function initItems() { return Object.fromEntries([...INSP_LEFT, ...INSP_RIGHT].map(i => [i.id, 'na' as ItemStatus])) }
function initBody()  { return Object.fromEntries(BODY_PARTS.map(p => [p.id, 'ok' as AvariaStatus])) }

// ─── SVG Diagram ──────────────────────────────────────────────────────────────
function Diagrama({ body, selected, onSelect }: {
  body: Record<string, AvariaStatus>; selected: AvariaStatus; onSelect: (id: string) => void
}) {
  const f  = (id: string) => AVARIA_CFG[body[id] ?? 'ok'].fill
  const sk = (id: string) => body[id] !== 'ok' ? AVARIA_CFG[body[id]].stroke : '#9ca3af'
  const sw = (id: string) => body[id] !== 'ok' ? 1.8 : 0.8

  const P = ({ id, x, y, w, h, label, rx = 3 }: { id: string; x: number; y: number; w: number; h: number; label: string; rx?: number }) => (
    <g onClick={() => onSelect(id)} style={{ cursor: 'pointer' }}>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={f(id)} stroke={sk(id)} strokeWidth={sw(id)} />
      {h > 16 && w > 24 && (
        <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.min(w/6, 6.5)} fill="#1f2937" fontFamily="sans-serif" style={{ pointerEvents:'none' }}>
          {label}
        </text>
      )}
      {body[id] !== 'ok' && (
        <text x={x+w-5} y={y+8} fontSize={7.5} fill="#1f2937" fontFamily="sans-serif" fontWeight="bold" style={{ pointerEvents:'none' }}>
          {body[id]}
        </text>
      )}
    </g>
  )

  return (
    <svg viewBox="0 0 240 500" style={{ width: '100%', maxWidth: 185 }} className="mx-auto">
      <P id="pch_diant" x={35}  y={8}   w={170} h={20}  label="P.Ch. Diant." rx={6} />
      <P id="par_de"    x={10}  y={32}  w={37}  h={66}  label="Par.D.E" />
      <P id="par_dd"    x={193} y={32}  w={37}  h={66}  label="Par.D.D" />
      <P id="capo"      x={51}  y={32}  w={138} h={66}  label="Capô" rx={4} />
      {/* Retrovisores */}
      <g onClick={() => onSelect('ret_esq')} style={{ cursor:'pointer' }}>
        <rect x={0} y={102} width={12} height={24} rx={2} fill={f('ret_esq')} stroke={sk('ret_esq')} strokeWidth={sw('ret_esq')} />
      </g>
      <g onClick={() => onSelect('ret_dir')} style={{ cursor:'pointer' }}>
        <rect x={228} y={102} width={12} height={24} rx={2} fill={f('ret_dir')} stroke={sk('ret_dir')} strokeWidth={sw('ret_dir')} />
      </g>
      {/* Parabrisa */}
      <g onClick={() => onSelect('vid_parab')} style={{ cursor:'pointer' }}>
        <rect x={59} y={102} width={122} height={26} rx={2} fill={f('vid_parab')} stroke={sk('vid_parab')} strokeWidth={sw('vid_parab')} />
        <text x={120} y={115} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#1e3a5f" fontFamily="sans-serif" style={{ pointerEvents:'none' }}>Parabrisa</text>
      </g>
      <P id="por_de"    x={10}  y={102} w={37}  h={88}  label="P.D.Esq" />
      <P id="por_dd"    x={193} y={102} w={37}  h={88}  label="P.D.Dir" />
      {/* Teto */}
      <g onClick={() => onSelect('teto')} style={{ cursor:'pointer' }}>
        <rect x={51} y={102} width={138} height={180} rx={4} fill={f('teto')} stroke={sk('teto')} strokeWidth={sw('teto')} />
        <text x={120} y={192} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#1f2937" fontFamily="sans-serif" style={{ pointerEvents:'none' }}>Teto</text>
        {body['teto'] !== 'ok' && <text x={165} y={110} fontSize={7.5} fill="#1f2937" fontFamily="sans-serif" fontWeight="bold" style={{ pointerEvents:'none' }}>{body['teto']}</text>}
      </g>
      {/* Vidro traseiro */}
      <g onClick={() => onSelect('vid_tras')} style={{ cursor:'pointer' }}>
        <rect x={59} y={256} width={122} height={26} rx={2} fill={f('vid_tras')} stroke={sk('vid_tras')} strokeWidth={sw('vid_tras')} />
        <text x={120} y={269} textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#1e3a5f" fontFamily="sans-serif" style={{ pointerEvents:'none' }}>Vid. Tras.</text>
      </g>
      <P id="por_te"    x={10}  y={194} w={37}  h={88}  label="P.T.Esq" />
      <P id="por_td"    x={193} y={194} w={37}  h={88}  label="P.T.Dir" />
      <P id="par_te"    x={10}  y={286} w={37}  h={66}  label="Par.T.E" />
      <P id="par_td"    x={193} y={286} w={37}  h={66}  label="Par.T.D" />
      <P id="tampa"     x={51}  y={286} w={138} h={66}  label="Tampa Tras." rx={4} />
      <P id="pch_tras"  x={35}  y={356} w={170} h={20}  label="P.Ch. Tras." rx={6} />
      {/* Rodas */}
      {[['rod_de',24,66],['rod_dd',216,66],['rod_te',24,324],['rod_td',216,324]].map(([id,cx,cy]) => (
        <g key={id as string} onClick={() => onSelect(id as string)} style={{ cursor:'pointer' }}>
          <ellipse cx={cx as number} cy={cy as number} rx={10} ry={14}
            fill={f(id as string)} stroke={sk(id as string)} strokeWidth={sw(id as string)} />
          {body[id as string] !== 'ok' && (
            <text x={cx as number} y={cy as number} textAnchor="middle" dominantBaseline="middle"
              fontSize={7} fill="#1f2937" fontFamily="sans-serif" fontWeight="bold" style={{ pointerEvents:'none' }}>
              {body[id as string]}
            </text>
          )}
        </g>
      ))}
      {/* Marcador ativo */}
      <rect x={55} y={388} width={130} height={18} rx={4} fill={AVARIA_CFG[selected].fill} stroke={AVARIA_CFG[selected].stroke} strokeWidth={1} />
      <text x={120} y={397} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fill="#1f2937" fontFamily="sans-serif">
        ✏ {selected === 'ok' ? 'Sem avaria' : `(${selected}) ${AVARIA_CFG[selected].label}`}
      </text>
      <text x={120} y={490} textAnchor="middle" fontSize={8} fill="#6b7280" fontFamily="sans-serif">▲ FRENTE</text>
    </svg>
  )
}

// ─── Inspection Row ───────────────────────────────────────────────────────────
function InspRow({ item, status, onChange }: {
  item: { id: string; label: string }; status: ItemStatus; onChange: (id: string, s: ItemStatus) => void
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 0', borderBottom:'1px solid #f3f4f6' }}>
      {/* Botões coloridos (tela) */}
      <div className="no-print" style={{ display:'flex', gap:3, flexShrink:0 }}>
        {ITEM_ORDER.map(s => (
          <button key={s} onClick={() => onChange(item.id, status === s ? 'na' : s)}
            style={{
              width: 42, height: 22, fontSize: 10, fontWeight: 700, border: '1px solid',
              borderRadius: 4, cursor: 'pointer',
              background: status === s ? ITEM_CFG[s].bg : '#f9fafb',
              color: status === s ? ITEM_CFG[s].color : '#9ca3af',
              borderColor: status === s ? ITEM_CFG[s].bg : '#e5e7eb',
              opacity: status === s ? 1 : 0.7,
            }}>
            {ITEM_CFG[s].label}
          </button>
        ))}
      </div>
      {/* Caixinhas na impressão */}
      <div className="print-only" style={{ display:'none', gap:3, flexShrink:0 }}>
        {ITEM_ORDER.map(s => (
          <div key={s} style={{
            width: 20, height: 16, fontSize: 8, fontWeight: 700, border: '1px solid',
            borderRadius: 2, display:'flex', alignItems:'center', justifyContent:'center',
            background: status === s ? ITEM_CFG[s].bg : '#fff',
            color: status === s ? ITEM_CFG[s].color : '#d1d5db',
            borderColor: status === s ? ITEM_CFG[s].bg : '#d1d5db',
          }}>
            {ITEM_CFG[s].short}
          </div>
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{item.label}</span>
    </div>
  )
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', readOnly = false, span = 1 }: {
  label: string; value: string; onChange?: (v: string) => void
  placeholder?: string; type?: string; readOnly?: boolean; span?: number
}) {
  return (
    <div style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
      <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      {readOnly
        ? <div style={{ borderBottom: `1px solid ${TEAL}`, minHeight: 22, fontSize: 12, fontWeight: 600, color: NAVY, paddingBottom: 2 }}>
            {value || <span style={{ color: '#d1d5db' }}>{'_'.repeat(20)}</span>}
          </div>
        : <input type={type} value={value} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
            style={{ borderBottom: `1px solid #d1d5db`, width: '100%', fontSize: 12, color: NAVY,
              background: 'transparent', outline: 'none', paddingBottom: 2 }}
          />
      }
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700,
      letterSpacing: 1, padding: '4px 10px', marginBottom: 10, borderRadius: 4 }}>
      {title.toUpperCase()}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChecklistPage() {
  const [placa, setPlaca]     = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const [veiculo, setVeiculo] = useState<VeiculoInfo | null>(null)
  const [logo, setLogo]       = useState<string | null>(null)
  const logoRef               = useRef<HTMLInputElement>(null)

  const [marca, setMarca]   = useState('')
  const [modelo, setModelo] = useState('')
  const [ano, setAno]       = useState('')
  const [km, setKm]         = useState('')
  const [placaV, setPlacaV] = useState('')
  const [ultima, setUltima] = useState('')
  const [nome, setNome]     = useState('')
  const [fone, setFone]     = useState('')
  const [cnh, setCnh]       = useState('')
  const [cat, setCat]       = useState('')
  const [venc, setVenc]     = useState('')
  const [outroObs, setOutroObs] = useState('')
  const [obs, setObs]       = useState('')
  const [data, setData]     = useState(() => new Date().toISOString().slice(0, 10))
  const [resp, setResp]     = useState('')

  const [items, setItems]   = useState<Record<string, ItemStatus>>(initItems)
  const [body, setBody]     = useState<Record<string, AvariaStatus>>(initBody)
  const [selAvaria, setSelAvaria] = useState<AvariaStatus>('A')

  const handleBuscar = async () => {
    const p = placa.trim().toUpperCase()
    if (!p) return
    setLoading(true); setErro(''); setVeiculo(null)
    try {
      const res  = await fetch(`/api/checklist/veiculo/placa/${p}`)
      const json = await res.json()
      if (!json.ok) { setErro(json.erro || 'Veículo não encontrado.'); return }
      const v = json.veiculo
      setVeiculo(v)
      setMarca(v.marca || '')
      setModelo(v.modelo || v.descricao || '')
      setPlacaV(v.placa || '')
      setKm(v.km ? String(v.km) : '')
      setNome(v.cliente.nome || '')
      setFone(v.cliente.celular || v.cliente.telefone || '')
      setItems(initItems()); setBody(initBody()); setObs('')
    } catch { setErro('Erro ao conectar com a API.') }
    finally { setLoading(false) }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setLogo(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDiagramClick = useCallback((id: string) => {
    setBody(prev => ({ ...prev, [id]: prev[id] === selAvaria ? 'ok' : selAvaria }))
  }, [selAvaria])

  const setItem = useCallback((id: string, s: ItemStatus) => {
    setItems(prev => ({ ...prev, [id]: s }))
  }, [])

  useEffect(() => {
    document.title = placaV ? `Checklist ${placaV}` : 'Checklist de Veículo'
  }, [placaV])

  const fmtDate = (iso: string) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : ''

  const avariaCount = Object.values(body).filter(v => v !== 'ok').length

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          body { background: white; margin: 0; }
          @page { size: A4 portrait; margin: 8mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-2col { display: grid !important; grid-template-columns: 1fr 1fr !important; }
          .print-4col { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; }
          .print-3col { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
        input { font-family: inherit; }
        button { font-family: inherit; }
      `}</style>

      {/* ── Toolbar (screen only) ── */}
      <div className="no-print" style={{
        background: NAVY, color: '#fff', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <img src="/logo-seven.png" alt="Logo" style={{ height: 32, objectFit: 'contain' }} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 8 }}>Checklist de Veículo</span>
        <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handleBuscar()}
          placeholder="Placa..." maxLength={8}
          style={{ border: '1px solid #3E7080', borderRadius: 6, padding: '0 12px', height: 36,
            fontSize: 13, letterSpacing: 3, background: '#1e3a52', color: '#fff',
            outline: 'none', width: 120 }} />
        <button onClick={handleBuscar} disabled={loading}
          style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 6,
            padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6, opacity: loading ? 0.6 : 1 }}>
          <Search size={14} />{loading ? 'Buscando…' : 'Buscar'}
        </button>
        <button onClick={() => { setItems(initItems()); setBody(initBody()); setObs('') }}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={14} /> Limpar
        </button>
        <button onClick={() => logoRef.current?.click()}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <Upload size={14} /> Logo
        </button>
        <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
        <button onClick={() => window.print()}
          style={{ marginLeft: 'auto', background: '#fff', color: NAVY, border: 'none',
            borderRadius: 6, padding: '0 18px', height: 36, cursor: 'pointer', fontSize: 13,
            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Printer size={14} /> Imprimir
        </button>
      </div>
      {erro && (
        <div className="no-print" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 20px', fontSize: 13 }}>
          {erro}
        </div>
      )}

      {/* ── Document ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px', background: '#fff' }}
        className="print:p-0 print:max-w-none">

        {/* ── Print Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `3px solid ${NAVY}`, paddingBottom: 10, marginBottom: 14 }}>
          <img
            src={logo || '/logo-seven.png'}
            alt="Logo"
            style={{ height: 48, objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, letterSpacing: 2 }}>
              CHECK-LIST DE VEÍCULO
            </div>
            <div style={{ fontSize: 11, color: TEAL, marginTop: 2 }}>
              {fmtDate(data) || new Date().toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div style={{ width: 80, textAlign: 'right' }}>
            {veiculo && (
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, letterSpacing: 3,
                border: `2px solid ${TEAL}`, borderRadius: 6, padding: '4px 8px', textAlign: 'center' }}>
                {veiculo.placa}
              </div>
            )}
          </div>
        </div>

        {/* ── Dados do Veículo ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeader title="Dados do Veículo" />
          <div className="print-4col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px 24px' }}>
            <Field label="Marca"    value={marca}   onChange={setMarca}   placeholder="_______________" />
            <Field label="Modelo"   value={modelo}  onChange={setModelo}  placeholder="_______________" />
            <Field label="Ano/Modelo" value={ano}   onChange={setAno}     placeholder="____/____" />
            <Field label="Placa"    value={placaV}  onChange={setPlacaV}  placeholder="___________" />
            <Field label="KM"       value={km}      onChange={setKm}      placeholder="0" type="number" />
            <Field label="Última Manutenção" value={ultima} onChange={setUltima} placeholder="__/__/____" />
            <Field label="Descrição / Cor" value={veiculo?.descricao || ''} readOnly />
            <Field label="Data de Entrada" value={data} onChange={setData} type="date" />
          </div>
        </div>

        {/* ── Dados do Motorista ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeader title="Dados do Motorista / Responsável" />
          <div className="print-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '10px 24px' }}>
            <div style={{ gridColumn: 'span 1' }}>
              <Field label="Nome" value={nome} onChange={setNome} placeholder="Nome completo" />
            </div>
            <Field label="Fone" value={fone} onChange={setFone} placeholder="(00) 00000-0000" />
            <Field label="CNH"  value={cnh}  onChange={setCnh}  placeholder="N° da CNH" />
            <Field label="Categoria" value={cat} onChange={setCat} placeholder="A / B / AB…" />
            <Field label="Vencimento" value={venc} onChange={setVenc} placeholder="__/__/____" />
          </div>
        </div>

        {/* ── Itens Inspecionados ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeader title="Itens Inspecionados" />

          {/* Legenda tela */}
          <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            {ITEM_ORDER.map(s => (
              <span key={s} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11,
                fontWeight: 700, background: ITEM_CFG[s].bg, color: ITEM_CFG[s].color }}>
                {ITEM_CFG[s].label}
              </span>
            ))}
            <span style={{ fontSize: 11, color: '#9ca3af' }}>— clique para marcar</span>
          </div>
          {/* Legenda impressão */}
          <div className="print-only" style={{ display: 'none', gap: 12, marginBottom: 6, fontSize: 9 }}>
            {ITEM_ORDER.map(s => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 16, height: 12, borderRadius: 2, background: ITEM_CFG[s].bg,
                  display: 'inline-block', border: `1px solid ${ITEM_CFG[s].bg}` }} />
                ({ITEM_CFG[s].short}) {ITEM_CFG[s].label}
              </span>
            ))}
          </div>

          {/* Grid 2 colunas — mantido tanto em tela quanto na impressão */}
          <div className="print-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 28px' }}>
            <div>
              {INSP_LEFT.map(item => <InspRow key={item.id} item={item} status={items[item.id]} onChange={setItem} />)}
            </div>
            <div>
              {INSP_RIGHT.map(item => (
                <div key={item.id}>
                  <InspRow item={item} status={items[item.id]} onChange={setItem} />
                  {item.id === 'outro' && (
                    <input value={outroObs} onChange={e => setOutroObs(e.target.value)}
                      placeholder="Especificar..." className="no-print"
                      style={{ borderBottom: '1px solid #e5e7eb', width: '100%', fontSize: 10,
                        color: '#6b7280', background: 'transparent', outline: 'none', padding: '1px 0' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Avarias ── */}
        <div style={{ marginBottom: 14 }}>
          <SectionHeader title={`Avarias ${avariaCount > 0 ? `(${avariaCount} identificada${avariaCount > 1 ? 's' : ''})` : ''}`} />

          {/* Legenda marcação — tela */}
          <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Marcar como:</span>
            {AVARIA_ORDER.map(s => (
              <button key={s} onClick={() => setSelAvaria(s)}
                style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  background: AVARIA_CFG[s].fill, border: `2px solid ${AVARIA_CFG[s].stroke}`,
                  color: '#1f2937', transform: selAvaria === s ? 'scale(1.08)' : 'scale(1)',
                  boxShadow: selAvaria === s ? `0 0 0 2px ${NAVY}` : 'none',
                  transition: 'all 0.1s',
                }}>
                {s === 'ok' ? 'OK' : `(${s})`} {AVARIA_CFG[s].label}
              </button>
            ))}
          </div>
          {/* Legenda impressão */}
          <div className="print-only" style={{ display: 'none', gap: 16, marginBottom: 6, fontSize: 9 }}>
            {AVARIA_ORDER.filter(s => s !== 'ok').map(s => (
              <span key={s}>
                <b>({s})</b> {AVARIA_CFG[s].label}
              </span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 16 }}>
            {/* Diagram */}
            <Diagrama body={body} selected={selAvaria} onSelect={handleDiagramClick} />

            {/* Summary grid */}
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6 }}>
                Resumo por peça:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                {BODY_PARTS.map(p => {
                  const s = body[p.id]
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '3px 8px', borderRadius: 4, fontSize: 10,
                      background: s !== 'ok' ? AVARIA_CFG[s].fill : '#f9fafb',
                      border: `1px solid ${s !== 'ok' ? AVARIA_CFG[s].stroke : '#e5e7eb'}`,
                      color: s !== 'ok' ? '#1f2937' : '#9ca3af',
                    }}>
                      <span>{p.label}</span>
                      <span style={{ fontWeight: 800 }}>{s === 'ok' ? '—' : s}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* OBS avarias */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 4 }}>OBS:</div>
            <textarea value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Observações sobre as avarias..." rows={2}
              style={{ width: '100%', border: `1px solid #e5e7eb`, borderRadius: 4, padding: '6px 8px',
                fontSize: 11, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* ── Assinaturas ── */}
        <div style={{ marginBottom: 12 }}>
          <SectionHeader title="Assinaturas" />
          <div className="print-3col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
            {[
              { label: 'Responsável pela Verificação', val: resp, set: setResp },
              { label: 'Motorista / Cliente', val: '', set: () => {} },
              { label: 'Data', val: fmtDate(data), set: () => {} },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <div style={{ borderBottom: `1.5px solid ${NAVY}`, minHeight: 32, paddingBottom: 2 }}>
                  {label === 'Responsável pela Verificação' ? (
                    <input value={val} onChange={e => set(e.target.value)} placeholder="Nome do responsável"
                      className="no-print"
                      style={{ border: 'none', outline: 'none', width: '100%', fontSize: 12,
                        color: NAVY, background: 'transparent', fontFamily: 'inherit' }} />
                  ) : (
                    <div style={{ fontSize: 12, color: NAVY }}>{val}</div>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 4 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e5e7eb',
            fontSize: 11, color: '#4b5563' }}>
            Aprovado por: <span style={{ borderBottom: '1px solid #9ca3af', paddingBottom: 1 }}>
              ________________________________________________
            </span> &nbsp;—&nbsp; Gestor da Frota &nbsp;—&nbsp; Visto: ______________________
          </div>
        </div>

        {/* ── Footer print ── */}
        <div className="print-only" style={{ display: 'none', justifyContent: 'space-between',
          fontSize: 8, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 6, marginTop: 8 }}>
          <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
          <span style={{ color: TEAL, fontWeight: 700 }}>Seven Soluções</span>
        </div>

        {/* ── Botão imprimir (tela) ── */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, paddingBottom: 32 }}>
          <button onClick={() => window.print()}
            style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} /> Imprimir Checklist
          </button>
        </div>
      </div>
    </div>
  )
}
