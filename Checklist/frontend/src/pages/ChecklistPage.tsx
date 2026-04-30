import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Printer, RotateCcw, Upload, Camera, X, Save, ImageIcon, History, FilePlus, LayoutDashboard } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

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

interface UltimaOS {
  id: number
  data: string | null
  dataSaida: string | null
  numeroNota: string
  tipo: string
  tipoLabel: string
  observacao: string
  km: number
  colaborador: string
}

interface FotoItem {
  id: string
  file: File
  preview: string // object URL
}

const TIPO_COLOR: Record<string, { bg: string; color: string }> = {
  'V':  { bg: '#dcfce7', color: '#15803d' },
  'O':  { bg: '#fef9c3', color: '#a16207' },
  'S':  { bg: '#dbeafe', color: '#1d4ed8' },
  'PV': { bg: '#fee2e2', color: '#b91c1c' },
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
    <svg viewBox="-4 -4 248 415" style={{ width: '100%', maxWidth: 185, display: 'block' }} className="mx-auto">
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
      {/* Label de orientação — sempre visível */}
      <text x={120} y={382} textAnchor="middle" fontSize={8} fill="#6b7280" fontFamily="sans-serif">▲ FRENTE</text>
      {/* Marcador ativo — visível só na tela, oculto na impressão */}
      <g className="no-print">
        <rect x={55} y={390} width={130} height={18} rx={4} fill={AVARIA_CFG[selected].fill} stroke={AVARIA_CFG[selected].stroke} strokeWidth={1} />
        <text x={120} y={399} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fill="#1f2937" fontFamily="sans-serif">
          ✏ {selected === 'ok' ? 'Sem avaria' : `(${selected}) ${AVARIA_CFG[selected].label}`}
        </text>
      </g>
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
export default function ChecklistPage({ onHistorico, onKanban }: { onHistorico?: () => void; onKanban?: () => void }) {
  const [placa, setPlaca]     = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro]       = useState('')
  const [veiculo, setVeiculo]     = useState<VeiculoInfo | null>(null)
  const [ultimaOS, setUltimaOS]   = useState<UltimaOS | null>(null)
  const [osList, setOsList]       = useState<UltimaOS[]>([])
  const [showOSPicker, setShowOSPicker] = useState(false)
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

  // ─── Fotos ───────────────────────────────────────────────────────────────────
  const [fotos, setFotos] = useState<FotoItem[]>([])
  const fotoInputRef = useRef<HTMLInputElement>(null)

  // ─── Ref do conteúdo para geração do PDF ─────────────────────────────────────
  const contentRef = useRef<HTMLDivElement>(null)

  // ─── Modal salvar ─────────────────────────────────────────────────────────────
  const [modalSalvar, setModalSalvar] = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [sessaoSalva, setSessaoSalva] = useState<string | null>(null)
  const [printComFotos, setPrintComFotos] = useState(true)

  const handleAbrirKanban = () => window.open('/?kanban', '_blank')

  // ─── Gera PDF do conteúdo do checklist como Blob ─────────────────────────────
  const gerarPdfBlob = async (): Promise<Blob | null> => {
    const el = contentRef.current
    if (!el) return null
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        ignoreElements: (node) => node.classList?.contains('no-print'),
        onclone: (_doc, clonedEl) => {
          // Mostrar elementos print-only (ocultos na tela, mas devem aparecer no PDF)
          clonedEl.querySelectorAll('.print-only').forEach(el => {
            (el as HTMLElement).style.setProperty('display', 'flex', 'important')
          })
          // Mostrar fotos no PDF se visíveis
          clonedEl.querySelectorAll('.fotos-print-visible').forEach(el => {
            (el as HTMLElement).style.setProperty('display', 'block', 'important')
          })
          clonedEl.querySelectorAll('.fotos-print-hidden').forEach(el => {
            (el as HTMLElement).style.setProperty('display', 'none', 'important')
          })

          // html2canvas não captura value de inputs React — substituir por spans visíveis
          clonedEl.querySelectorAll('input').forEach(inp => {
            const input = inp as HTMLInputElement
            if (['file', 'checkbox', 'radio'].includes(input.type)) return
            const span = _doc.createElement('span')
            span.textContent = input.value
            span.style.display = 'block'
            span.style.fontSize = '12px'
            span.style.color = '#13293D'
            span.style.borderBottom = input.style.borderBottom || '1px solid #d1d5db'
            span.style.paddingBottom = '2px'
            span.style.minHeight = '18px'
            span.style.fontFamily = 'Inter, sans-serif'
            span.style.width = '100%'
            inp.replaceWith(span)
          })
          clonedEl.querySelectorAll('textarea').forEach(ta => {
            const textarea = ta as HTMLTextAreaElement
            const div = _doc.createElement('div')
            div.textContent = textarea.value
            div.style.fontSize = '11px'
            div.style.color = '#374151'
            div.style.border = '1px solid #e5e7eb'
            div.style.borderRadius = '4px'
            div.style.padding = '6px 8px'
            div.style.whiteSpace = 'pre-wrap'
            div.style.fontFamily = 'Inter, sans-serif'
            div.style.minHeight = '44px'
            ta.replaceWith(div)
          })
        },
      })
      const imgW   = 210                                    // A4 largura em mm
      const imgH   = (canvas.height * imgW) / canvas.width
      const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageH  = 297                                    // A4 altura em mm
      let   posY   = 0

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, posY, imgW, imgH)
      let restante = imgH - pageH
      while (restante > 0) {
        posY -= pageH
        pdf.addPage()
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, posY, imgW, imgH)
        restante -= pageH
      }
      return pdf.output('blob')
    } catch {
      return null
    }
  }

  const handleBuscar = async () => {
    const p = placa.trim().toUpperCase()
    if (!p) return
    setLoading(true); setErro(''); setVeiculo(null); setUltimaOS(null); setOsList([]); setShowOSPicker(false)
    try {
      const res  = await fetch(`/api/checklist/veiculo/placa/${p}`)
      const json = await res.json()
      if (!json.ok) { setErro(json.erro || 'Veículo não encontrado.'); return }
      const v = json.veiculo
      setVeiculo(v)
      setMarca(v.marca || '')
      setModelo(v.modelo || v.descricao || '')
      setPlacaV(v.placa || '')
      setNome(v.cliente.nome || '')
      setFone(v.cliente.celular || v.cliente.telefone || '')
      setItems(initItems()); setBody(initBody())

      const list: UltimaOS[] = json.osList || []
      setOsList(list)

      if (list.length > 1) {
        // Múltiplas OS — abre o seletor, não preenche nada ainda
        setKm(v.km ? String(v.km) : '')
        setObs('')
        setUltimaOS(null)
        setShowOSPicker(true)
      } else {
        // Nenhuma ou apenas uma OS — carrega direto
        const os: UltimaOS | null = json.ultimaOS || null
        setUltimaOS(os)
        setKm(os?.km ? String(os.km) : (v.km ? String(v.km) : ''))
        setObs(os?.observacao || '')
      }
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

  const fmtDate = (iso: string | null) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

  const handleSelectOS = (os: UltimaOS) => {
    setUltimaOS(os)
    setKm(os.km ? String(os.km) : '')
    setObs(os.observacao || '')
    setShowOSPicker(false)
  }

  // ─── Fotos handlers ───────────────────────────────────────────────────────────
  const handleAddFotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const novas: FotoItem[] = files.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }))
    setFotos(prev => [...prev, ...novas])
    e.target.value = '' // permite selecionar a mesma foto novamente
  }

  const handleRemoveFoto = (id: string) => {
    setFotos(prev => {
      const item = prev.find(f => f.id === id)
      if (item) URL.revokeObjectURL(item.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  // ─── Monta payload do checklist ───────────────────────────────────────────────
  const buildPayload = () => ({
    veiculo: { placa: placaV, marca, modelo, ano, km, descricao: veiculo?.descricao || '', ultima },
    motorista: { nome, fone, cnh, categoria: cat, vencimento: venc },
    itens: items,
    avarias: body,
    obs,
    outroObs,
    data,
    responsavel: resp,
    clienteId: veiculo?.cliente.id || null,
    osId: ultimaOS?.id || null,
  })

  // ─── Salvar no servidor ───────────────────────────────────────────────────────
  const handleSalvar = async (imprimirApos: boolean, comFotos: boolean, iniciarKanban = false) => {
    setSalvando(true)
    try {
      const form = new FormData()
      form.append('dados', JSON.stringify(buildPayload()))
      fotos.forEach(f => form.append('fotos', f.file))

      const pdfBlob = await gerarPdfBlob()
      if (pdfBlob) {
        const nome = placaV ? `checklist_${placaV}.pdf` : 'checklist.pdf'
        form.append('pdf', pdfBlob, nome)
      }

      const res  = await fetch('/api/vistoria/salvar', { method: 'POST', body: form })
      const json = await res.json()
      if (!json.ok) throw new Error(json.erro || 'Erro ao salvar.')

      setSessaoSalva(json.sessao)
      setModalSalvar(false)

      // Criar card no Kanban se solicitado
      if (iniciarKanban) {
        const kanbanRes = await fetch('/api/kanban/card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            placa:     placaV || json.placa,
            veiculo:   `${marca} ${modelo}`.trim(),
            cor:       veiculo?.descricao || '',
            motorista: nome,
            sessao:    json.sessao,
          }),
        })
        const kanbanJson = await kanbanRes.json()
        if (kanbanJson.jaExiste) {
          alert(`Este veículo (${placaV || json.placa}) já está no Kanban com uma O.S. em aberto. O Kanban será aberto.`)
        }
        window.open('/?kanban', '_blank')
        return
      }

      if (imprimirApos) {
        setPrintComFotos(comFotos)
        setTimeout(() => window.print(), 120)
      }
    } catch (err: unknown) {
      alert(`Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSalvando(false)
    }
  }

  const handleNovaVistoria = () => {
    fotos.forEach(f => URL.revokeObjectURL(f.preview))
    setPlaca('')
    setVeiculo(null)
    setUltimaOS(null)
    setOsList([])
    setShowOSPicker(false)
    setErro('')
    setMarca(''); setModelo(''); setAno(''); setKm(''); setPlacaV('')
    setUltima(''); setNome(''); setFone(''); setCnh(''); setCat(''); setVenc('')
    setOutroObs(''); setObs(''); setResp('')
    setData(new Date().toISOString().slice(0, 10))
    setItems(initItems())
    setBody(initBody())
    setSelAvaria('A')
    setFotos([])
    setSessaoSalva(null)
  }

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
          .fotos-print-hidden { display: none !important; }
          .fotos-print-visible { display: block !important; }
        }
        @media screen {
          .print-only { display: none !important; }
          .fotos-print-visible { display: none !important; }
          .fotos-print-hidden { display: block !important; }
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
        <button onClick={handleNovaVistoria}
          style={{ background: '#3E7080', color: '#fff', border: 'none',
            borderRadius: 6, padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13,
            fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FilePlus size={14} /> Nova Vistoria
        </button>
        <button onClick={() => { setItems(initItems()); setBody(initBody()); setObs('') }}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={14} /> Limpar
        </button>
        {onHistorico && (
          <button onClick={onHistorico}
            style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
              borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={14} /> Histórico
          </button>
        )}
        {onKanban && (
          <button onClick={handleAbrirKanban}
            style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
              borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6 }}>
            <LayoutDashboard size={14} /> Kanban
          </button>
        )}
        <button onClick={() => logoRef.current?.click()}
          style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
            borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6 }}>
          <Upload size={14} /> Logo
        </button>
        <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
        {sessaoSalva && (
          <span style={{ fontSize: 11, color: '#86efac', marginLeft: 4 }}>
            ✓ Salvo
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()}
            style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
              borderRadius: 6, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={14} /> Imprimir
          </button>
          <button onClick={() => setModalSalvar(true)}
            style={{ background: '#fff', color: NAVY, border: 'none',
              borderRadius: 6, padding: '0 18px', height: 36, cursor: 'pointer', fontSize: 13,
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> Salvar
          </button>
        </div>
      </div>
      {erro && (
        <div className="no-print" style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 20px', fontSize: 13 }}>
          {erro}
        </div>
      )}

      {/* ── Modal seleção de OS ── */}
      {showOSPicker && veiculo && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 10, width: '100%', maxWidth: 560,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden'
          }}>
            {/* Header modal */}
            <div style={{ background: NAVY, color: '#fff', padding: '14px 20px' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Selecionar Checklist</div>
              <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
                {veiculo.placa} — {veiculo.descricao || veiculo.modelo} — {osList.length} registros encontrados
              </div>
            </div>

            {/* Lista de OS */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {osList.map((os, idx) => {
                const tipoCor = TIPO_COLOR[os.tipo?.toUpperCase()] || TIPO_COLOR['O']
                return (
                  <button
                    key={os.id}
                    onClick={() => handleSelectOS(os)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 20px',
                      borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#f9fafb',
                      cursor: 'pointer', border: 'none', display: 'block',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#f9fafb')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      {/* Data em destaque */}
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: NAVY,
                        background: '#e0f2fe', borderRadius: 6, padding: '2px 10px',
                        minWidth: 90, textAlign: 'center'
                      }}>
                        {fmtDate(os.data || os.dataSaida)}
                      </span>
                      {/* Badge tipo */}
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px',
                        borderRadius: 20, background: tipoCor.bg, color: tipoCor.color
                      }}>
                        {os.tipoLabel || os.tipo || '—'}
                      </span>
                      {os.numeroNota && (
                        <span style={{ fontSize: 11, color: '#6b7280' }}>Nº {os.numeroNota}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>OS #{os.id}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#6b7280' }}>
                      {os.colaborador && <span>👤 {os.colaborador}</span>}
                      {os.km > 0 && <span>🔢 {os.km.toLocaleString('pt-BR')} km</span>}
                    </div>
                    {os.observacao && (
                      <div style={{
                        marginTop: 5, fontSize: 11, color: '#374151',
                        borderLeft: `3px solid ${TEAL}`, paddingLeft: 8,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
                      }}>
                        {os.observacao}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer modal */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Clique em um registro para abrir o checklist</span>
              <button onClick={() => setShowOSPicker(false)}
                style={{ fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #d1d5db',
                  borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Document ── */}
      <div ref={contentRef} style={{ maxWidth: 900, margin: '0 auto', padding: '16px', background: '#fff' }}
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

        {/* ── Última OS ── */}
        {ultimaOS && (
          <div style={{ marginBottom: 14, border: `1px solid ${TEAL}`, borderRadius: 6,
            padding: '10px 14px', background: '#f0f7fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: 1 }}>
                Última OS no sistema
              </span>
              {/* Badge tipo */}
              {ultimaOS.tipo && (
                <span style={{
                  padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: (TIPO_COLOR[ultimaOS.tipo.toUpperCase()] || TIPO_COLOR['O']).bg,
                  color: (TIPO_COLOR[ultimaOS.tipo.toUpperCase()] || TIPO_COLOR['O']).color,
                  border: `1px solid currentColor`,
                }}>
                  {ultimaOS.tipoLabel || ultimaOS.tipo}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                OS #{ultimaOS.id}
                {ultimaOS.numeroNota ? ` · Nº ${ultimaOS.numeroNota}` : ''}
                {ultimaOS.data ? ` · ${new Date(ultimaOS.data).toLocaleDateString('pt-BR')}` : ''}
                {ultimaOS.colaborador ? ` · ${ultimaOS.colaborador}` : ''}
                {ultimaOS.km ? ` · ${ultimaOS.km.toLocaleString('pt-BR')} km` : ''}
              </span>
            </div>
            {ultimaOS.observacao && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#374151',
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 4,
                padding: '6px 10px', borderLeft: `3px solid ${TEAL}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: TEAL, display: 'block', marginBottom: 2 }}>
                  OBSERVAÇÃO DA ÚLTIMA OS:
                </span>
                {ultimaOS.observacao}
              </div>
            )}
          </div>
        )}

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

          <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
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

        {/* ── Fotos da Vistoria (tela) ── */}
        <div className="no-print" style={{ marginBottom: 14 }}>
          <SectionHeader title={`Fotos da Vistoria${fotos.length > 0 ? ` (${fotos.length})` : ''}`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' }}>
            {/* Thumbnails */}
            {fotos.map(f => (
              <div key={f.id} style={{ position: 'relative', width: 110, flexShrink: 0 }}>
                <img src={f.preview} alt={f.file.name}
                  style={{ width: 110, height: 82, objectFit: 'cover', borderRadius: 6,
                    border: `1.5px solid #d1d5db`, display: 'block' }} />
                <button onClick={() => handleRemoveFoto(f.id)}
                  style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.55)',
                    color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0 }}>
                  <X size={11} />
                </button>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.file.name}
                </div>
              </div>
            ))}

            {/* Botão adicionar foto */}
            <button onClick={() => fotoInputRef.current?.click()}
              style={{ width: 110, height: 82, borderRadius: 6, cursor: 'pointer',
                border: `2px dashed ${TEAL}`, background: '#f0f9ff', color: TEAL,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                flexShrink: 0 }}>
              <Camera size={22} />
              Tirar / Adicionar Foto
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleAddFotos}
              style={{ display: 'none' }}
            />
          </div>
          {fotos.length === 0 && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, margin: '8px 0 0' }}>
              Nenhuma foto adicionada. No celular, o botão abre a câmera diretamente.
            </p>
          )}
        </div>

        {/* ── Fotos para impressão (flui naturalmente após o diagrama) ── */}
        <div className={printComFotos && fotos.length > 0 ? 'fotos-print-visible' : 'fotos-print-hidden'}
          style={{ marginBottom: 14 }}>
          <SectionHeader title={`Fotos da Vistoria (${fotos.length})`} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {fotos.map((f, i) => (
              <div key={f.id} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <img src={f.preview} alt={`Foto ${i + 1}`}
                  style={{ width: 185, height: 139, objectFit: 'cover', borderRadius: 4,
                    border: '1px solid #d1d5db', display: 'block' }} />
                <div style={{ fontSize: 9, color: '#6b7280', marginTop: 2, textAlign: 'center' }}>Foto {i + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Assinaturas — sempre após as fotos, sem quebrar no meio ── */}
        <div style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <SectionHeader title="Assinaturas" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0 28px' }}>

            {/* Responsável */}
            <div>
              <div style={{ minHeight: 36, display: 'flex', alignItems: 'flex-end', paddingBottom: 4,
                borderBottom: `1.5px solid ${NAVY}` }}>
                <input value={resp} onChange={e => setResp(e.target.value)}
                  placeholder="Nome do responsável"
                  className="no-print"
                  style={{ border: 'none', outline: 'none', width: '100%', fontSize: 12,
                    color: NAVY, background: 'transparent', fontFamily: 'inherit' }} />
                <div className="print-only" style={{ display: 'none', fontSize: 12, color: NAVY }}>
                  {resp}
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 5 }}>
                Responsável pela Verificação
              </div>
            </div>

            {/* Motorista */}
            <div>
              <div style={{ minHeight: 36, borderBottom: `1.5px solid ${NAVY}` }} />
              <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 5 }}>
                Motorista / Cliente
              </div>
            </div>

            {/* Data */}
            <div>
              <div style={{ minHeight: 36, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                paddingBottom: 4, borderBottom: `1.5px solid ${NAVY}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: NAVY, letterSpacing: 1 }}>
                  {fmtDate(data)}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', textAlign: 'center', marginTop: 5 }}>
                Data
              </div>
            </div>
          </div>

          {/* Aprovado por */}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb',
            display: 'grid', gridTemplateColumns: '1fr auto 120px', gap: '0 16px', alignItems: 'flex-end' }}>
            <div>
              <div style={{ minHeight: 28, borderBottom: `1px solid #9ca3af` }} />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Aprovado por</div>
            </div>
            <div style={{ fontSize: 11, color: '#4b5563', paddingBottom: 6, whiteSpace: 'nowrap' }}>
              — Gestor da Frota —
            </div>
            <div>
              <div style={{ minHeight: 28, borderBottom: `1px solid #9ca3af` }} />
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>Visto</div>
            </div>
          </div>
        </div>

        {/* ── Footer print ── */}
        <div className="print-only" style={{ display: 'none', justifyContent: 'space-between',
          fontSize: 8, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 6, marginTop: 8 }}>
          <span>Gerado em {new Date().toLocaleString('pt-BR')}</span>
          <span style={{ color: TEAL, fontWeight: 700 }}>Seven Soluções</span>
        </div>

        {/* ── Botões rodapé (tela) ── */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, paddingBottom: 32 }}>
          <button onClick={() => window.print()}
            style={{ background: 'transparent', color: NAVY, border: `2px solid ${NAVY}`, borderRadius: 8,
              padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => setModalSalvar(true)}
            style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={16} /> Salvar Vistoria
          </button>
        </div>
      </div>

      {/* ── Modal Salvar Vistoria ── */}
      {modalSalvar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
            boxShadow: '0 24px 80px rgba(0,0,0,0.35)', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ background: NAVY, color: '#fff', padding: '16px 20px' }}>
              <div style={{ fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={18} /> Salvar Vistoria
              </div>
              {placaV && (
                <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 3 }}>
                  {placaV} {marca && `— ${marca} ${modelo}`}
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Resumo fotos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
                background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
                border: '1px solid #e5e7eb' }}>
                <ImageIcon size={20} color={TEAL} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>
                    {fotos.length > 0 ? `${fotos.length} foto${fotos.length > 1 ? 's' : ''} capturada${fotos.length > 1 ? 's' : ''}` : 'Nenhuma foto adicionada'}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    As fotos serão salvas no servidor junto com os dados da vistoria.
                  </div>
                </div>
              </div>

              {/* Opção: incluir fotos no PDF */}
              {fotos.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                  border: `2px solid ${printComFotos ? TEAL : '#e5e7eb'}`,
                  background: printComFotos ? '#f0f9ff' : '#fff', transition: 'all 0.15s' }}>
                  <input
                    type="checkbox"
                    checked={printComFotos}
                    onChange={e => setPrintComFotos(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: TEAL }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: NAVY }}>Incluir fotos no PDF</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>As fotos serão impressas em página extra</div>
                  </div>
                </label>
              )}

              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                Os dados e fotos ficam salvos no servidor. Você poderá gerar o PDF novamente futuramente pelo histórico.
              </div>
            </div>

            {/* Ações */}
            <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => handleSalvar(false, false, true)}
                disabled={salvando}
                style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: salvando ? 0.7 : 1 }}>
                <LayoutDashboard size={16} />
                {salvando ? 'Salvando…' : 'Salvar e Iniciar Kanban'}
              </button>
              <button
                onClick={() => handleSalvar(true, printComFotos)}
                disabled={salvando}
                style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: salvando ? 0.7 : 1 }}>
                <Printer size={16} />
                {salvando ? 'Salvando…' : 'Salvar e Imprimir'}
              </button>
              <button
                onClick={() => handleSalvar(false, false)}
                disabled={salvando}
                style={{ background: TEAL, color: '#fff', border: 'none', borderRadius: 8,
                  padding: '12px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: salvando ? 0.7 : 1 }}>
                <Save size={16} />
                {salvando ? 'Salvando…' : 'Só Salvar (sem imprimir)'}
              </button>
              <button
                onClick={() => setModalSalvar(false)}
                disabled={salvando}
                style={{ background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db',
                  borderRadius: 8, padding: '10px 20px', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação de salvo ── */}
      {sessaoSalva && !modalSalvar && (
        <div className="no-print" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: '#166534', color: '#fff', borderRadius: 10,
          padding: '12px 20px', fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>✓ Vistoria salva com sucesso</span>
          <button onClick={() => setSessaoSalva(null)}
            style={{ background: 'transparent', border: 'none', color: '#bbf7d0',
              cursor: 'pointer', padding: 0, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
