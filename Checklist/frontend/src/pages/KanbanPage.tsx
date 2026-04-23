import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Monitor, X, MonitorOff, Trash2, Settings, Plus } from 'lucide-react'

const NAVY = '#13293D'
const TEAL = '#3E7080'

// ─── Status configurável ─────────────────────────────────────────────────────

interface StatusConfig {
  id:        number
  label:     string
  emoji:     string
  color:     string
  bg:        string
  semAlerta: boolean  // true = status final, não gera alerta de atraso
}

const COLOR_PALETTE: { color: string; bg: string }[] = [
  { color: '#6b7280', bg: '#f3f4f6' },
  { color: '#2563eb', bg: '#dbeafe' },
  { color: '#d97706', bg: '#fef3c7' },
  { color: '#ea580c', bg: '#ffedd5' },
  { color: '#7c3aed', bg: '#ede9fe' },
  { color: '#16a34a', bg: '#dcfce7' },
  { color: '#0d9488', bg: '#ccfbf1' },
  { color: '#475569', bg: '#f1f5f9' },
  { color: '#db2777', bg: '#fce7f3' },
  { color: '#0891b2', bg: '#e0f2fe' },
  { color: '#65a30d', bg: '#f7fee7' },
  { color: '#dc2626', bg: '#fee2e2' },
]

const DEFAULT_STATUSES: StatusConfig[] = [
  { id: 1, label: 'Aguardando Diagnóstico',    emoji: '🔍', color: '#6b7280', bg: '#f3f4f6', semAlerta: false },
  { id: 2, label: 'Em Diagnóstico',            emoji: '🔧', color: '#2563eb', bg: '#dbeafe', semAlerta: false },
  { id: 3, label: 'Aguardando Aprovação',      emoji: '✋', color: '#d97706', bg: '#fef3c7', semAlerta: false },
  { id: 4, label: 'Aguardando Peças',          emoji: '📦', color: '#ea580c', bg: '#ffedd5', semAlerta: false },
  { id: 5, label: 'Em Programação',            emoji: '📋', color: '#7c3aed', bg: '#ede9fe', semAlerta: false },
  { id: 6, label: 'Em Serviço',                emoji: '⚙️', color: '#16a34a', bg: '#dcfce7', semAlerta: false },
  { id: 7, label: 'Finalizado',                emoji: '✅', color: '#0d9488', bg: '#ccfbf1', semAlerta: true  },
  { id: 8, label: 'OS Fechada',                emoji: '📄', color: '#475569', bg: '#f1f5f9', semAlerta: true  },
  { id: 9, label: 'Aguardando Cliente Buscar', emoji: '🚗', color: '#db2777', bg: '#fce7f3', semAlerta: true  },
]

function loadStatuses(): StatusConfig[] {
  try {
    const s = localStorage.getItem('kanban_statuses')
    return s ? JSON.parse(s) : DEFAULT_STATUSES
  } catch { return DEFAULT_STATUSES }
}

function saveStatuses(s: StatusConfig[]) {
  localStorage.setItem('kanban_statuses', JSON.stringify(s))
}

// ─── Configurações de temporização ───────────────────────────────────────────

interface KanbanSettings {
  refreshSeconds:   number
  alertMinutes:     number
  alertCritMinutes: number
}

const DEFAULT_SETTINGS: KanbanSettings = {
  refreshSeconds:   60,
  alertMinutes:     60,
  alertCritMinutes: 120,
}

function loadSettings(): KanbanSettings {
  try {
    const s = localStorage.getItem('kanban_settings')
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}

function saveSettings(s: KanbanSettings) {
  localStorage.setItem('kanban_settings', JSON.stringify(s))
}

// ─── Tipos de dados ───────────────────────────────────────────────────────────

interface HistoricoItem {
  status: number
  label: string
  entrada: string
  saida: string | null
}

interface KanbanCard {
  id: string
  placa: string
  veiculo: string
  cor: string
  motorista: string
  sessao: string | null
  status: number
  criadoEm: string
  statusAtualizadoEm: string
  historico: HistoricoItem[]
}

function formatDuration(from: string, to?: string): string {
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime()
  const totalMins = Math.floor(ms / 60000)
  if (totalMins < 1) return 'agora'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

// ─── Card component ───────────────────────────────────────────────────────────
function Card({ card, tvMode, onClick, onRemove, settings, statuses }: {
  card: KanbanCard; tvMode: boolean
  onClick: () => void; onRemove: () => void
  settings: KanbanSettings
  statuses: StatusConfig[]
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), settings.refreshSeconds * 1000)
    return () => clearInterval(t)
  }, [settings.refreshSeconds])

  const st = statuses.find(s => s.id === card.status) ?? statuses[0]

  const minsNoStatus = Math.floor(
    (Date.now() - new Date(card.statusAtualizadoEm).getTime()) / 60000
  )
  const semAlerta = st?.semAlerta ?? false
  const isCrit    = !semAlerta && minsNoStatus >= settings.alertCritMinutes
  const isWarn    = !semAlerta && !isCrit && minsNoStatus >= settings.alertMinutes

  const alertBorder = isCrit ? '2px solid #ef4444' : isWarn ? '2px solid #f59e0b' : '1px solid #e5e7eb'
  const alertBg     = isCrit ? '#fff5f5' : isWarn ? '#fffbeb' : '#fff'
  const alertShadow = isCrit
    ? '0 0 0 3px rgba(239,68,68,0.2)'
    : isWarn
    ? '0 0 0 3px rgba(245,158,11,0.2)'
    : '0 1px 4px rgba(0,0,0,0.08)'

  return (
    <div
      style={{
        background: alertBg,
        borderRadius: 10,
        border: alertBorder,
        borderLeft: `4px solid ${isCrit ? '#ef4444' : isWarn ? '#f59e0b' : st.color}`,
        padding: tvMode ? '14px 16px' : '10px 12px',
        marginBottom: 8,
        boxShadow: alertShadow,
        transition: 'transform 0.1s, box-shadow 0.1s',
        position: 'relative',
        cursor: tvMode ? 'default' : 'pointer',
        animation: isCrit ? 'pulse-crit 2s infinite' : isWarn ? 'pulse-warn 3s infinite' : 'none',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        if (tvMode) return
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)'
      }}
      onMouseLeave={e => {
        if (tvMode) return
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'
      }}
    >
      {!tvMode && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          title="Remover do Kanban"
          style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(255,255,255,0.9)', border: '1px solid #fca5a5',
            borderRadius: 6, padding: '3px 5px', cursor: 'pointer',
            color: '#ef4444', display: 'flex', alignItems: 'center',
            opacity: 0, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          onFocus={e => (e.currentTarget.style.opacity = '1')}
          onBlur={e => (e.currentTarget.style.opacity = '0')}
        >
          <Trash2 size={12} />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: tvMode ? 24 : 17, fontWeight: 900, color: NAVY, letterSpacing: 2 }}>
          {card.placa}
        </span>
        {isCrit && (
          <span style={{
            fontSize: tvMode ? 12 : 10, fontWeight: 800, padding: '2px 7px',
            borderRadius: 20, background: '#ef4444', color: '#fff',
          }}>
            ⚠ ATRASADO
          </span>
        )}
        {isWarn && (
          <span style={{
            fontSize: tvMode ? 12 : 10, fontWeight: 800, padding: '2px 7px',
            borderRadius: 20, background: '#f59e0b', color: '#fff',
          }}>
            ⏰ ATENÇÃO
          </span>
        )}
      </div>
      {card.veiculo && (
        <div style={{ fontSize: tvMode ? 13 : 11, color: '#374151', fontWeight: 600, marginTop: 2 }}>
          {card.veiculo}{card.cor ? ` · ${card.cor}` : ''}
        </div>
      )}
      {card.motorista && (
        <div style={{ fontSize: tvMode ? 12 : 10, color: '#6b7280', marginTop: 1 }}>
          👤 {card.motorista}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: tvMode ? 12 : 10, fontWeight: 700,
          padding: '2px 8px', borderRadius: 20,
          background: st.bg, color: st.color,
        }}>
          ⏱ {formatDuration(card.statusAtualizadoEm)}
        </span>
        <span style={{
          fontSize: tvMode ? 12 : 10,
          padding: '2px 8px', borderRadius: 20,
          background: '#f3f4f6', color: '#6b7280',
        }}>
          Total: {formatDuration(card.criadoEm)}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function KanbanPage({ onVoltar }: { onVoltar: () => void }) {
  const [cards, setCards]             = useState<KanbanCard[]>([])
  const [selected, setSelected]       = useState<KanbanCard | null>(null)
  const [tvMode, setTvMode]           = useState(false)
  const [connected, setConnected]     = useState(false)
  const [clock, setClock]             = useState(new Date())
  const [settings, setSettings]       = useState<KanbanSettings>(loadSettings)
  const [statuses, setStatuses]       = useState<StatusConfig[]>(loadStatuses)
  const [modalSettings, setModalSettings] = useState(false)
  const [draft, setDraft]             = useState<KanbanSettings>(loadSettings)
  const [draftStatuses, setDraftStatuses] = useState<StatusConfig[]>([])
  const [settingsTab, setSettingsTab] = useState<'timing' | 'statuses'>('timing')
  const sseRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let es: EventSource

    const connect = () => {
      es = new EventSource('/api/kanban/eventos')
      sseRef.current = es

      es.addEventListener('init', e => {
        setCards(JSON.parse((e as MessageEvent).data))
        setConnected(true)
      })
      es.addEventListener('card_added', e => {
        const card = JSON.parse((e as MessageEvent).data) as KanbanCard
        setCards(prev => [...prev, card])
      })
      es.addEventListener('card_updated', e => {
        const card = JSON.parse((e as MessageEvent).data) as KanbanCard
        setCards(prev => prev.map(c => c.id === card.id ? card : c))
        setSelected(prev => prev?.id === card.id ? card : prev)
      })
      es.addEventListener('card_removed', e => {
        const { id } = JSON.parse((e as MessageEvent).data)
        setCards(prev => prev.filter(c => c.id !== id))
        setSelected(prev => prev?.id === id ? null : prev)
      })
      es.onerror = () => {
        setConnected(false)
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()
    return () => es?.close()
  }, [])

  const changeStatus = useCallback(async (cardId: string, status: number) => {
    const label = statuses.find(s => s.id === status)?.label
    await fetch(`/api/kanban/card/${cardId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, label }),
    })
    setSelected(null)
  }, [statuses])

  const removeCard = useCallback(async (cardId: string) => {
    if (!confirm('Remover este veículo do Kanban?')) return
    await fetch(`/api/kanban/card/${cardId}`, { method: 'DELETE' })
    setSelected(null)
  }, [])

  const toggleTvMode = () => {
    if (!tvMode) {
      document.documentElement.requestFullscreen?.().catch(() => {})
    } else {
      document.exitFullscreen?.().catch(() => {})
    }
    setTvMode(v => !v)
  }

  const abrirSettings = () => {
    setDraft(settings)
    setDraftStatuses(statuses.map(s => ({ ...s })))
    setSettingsTab('timing')
    setModalSettings(true)
  }

  const salvarSettings = () => {
    saveSettings(draft)
    setSettings(draft)
    const valid = draftStatuses.filter(s => s.label.trim())
    saveStatuses(valid)
    setStatuses(valid)
    setModalSettings(false)
  }

  const updateDraftStatus = (id: number, patch: Partial<StatusConfig>) => {
    setDraftStatuses(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const deleteDraftStatus = (id: number) => {
    setDraftStatuses(prev => prev.filter(s => s.id !== id))
  }

  const addDraftStatus = () => {
    const nextId = draftStatuses.length > 0
      ? Math.max(...draftStatuses.map(s => s.id)) + 1
      : 1
    const palette = COLOR_PALETTE[nextId % COLOR_PALETTE.length]
    setDraftStatuses(prev => [
      ...prev,
      { id: nextId, label: 'Novo Status', emoji: '🔖', color: palette.color, bg: palette.bg, semAlerta: false },
    ])
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: tvMode ? '#0a0f1a' : '#0f172a',
      fontFamily: 'Inter, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes pulse-warn {
          0%, 100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.2); }
          50%       { box-shadow: 0 0 0 6px rgba(245,158,11,0.35); }
        }
        @keyframes pulse-crit {
          0%, 100% { box-shadow: 0 0 0 3px rgba(239,68,68,0.25); }
          50%       { box-shadow: 0 0 0 8px rgba(239,68,68,0.4); }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div style={{
        background: NAVY, color: '#fff',
        padding: tvMode ? '10px 24px' : '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
      }}>
        {!tvMode && (
          <button onClick={onVoltar} style={{
            background: 'transparent', color: '#9ca3af',
            border: '1px solid #3E7080', borderRadius: 6,
            padding: '0 14px', height: 36, cursor: 'pointer',
            fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ArrowLeft size={14} /> Voltar
          </button>
        )}

        <img src="/logo-seven.png" alt="Logo" style={{ height: tvMode ? 36 : 28, objectFit: 'contain' }} />

        <span style={{ fontWeight: 800, fontSize: tvMode ? 18 : 15, letterSpacing: 1 }}>
          Painel da Oficina
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#22c55e' : '#ef4444',
            boxShadow: connected ? '0 0 6px #22c55e' : 'none',
          }} />
          {!tvMode && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {connected ? 'Ao vivo' : 'Reconectando…'}
            </span>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {!tvMode && (
            <button onClick={abrirSettings} style={{
              background: 'transparent', color: '#9ca3af', border: '1px solid #3E7080',
              borderRadius: 6, padding: '0 12px', height: 36, cursor: 'pointer',
              fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Settings size={14} /> Configurar
            </button>
          )}
          {tvMode && (
            <span style={{ fontSize: 15, color: '#93c5fd', fontWeight: 700 }}>
              {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
                {clock.toLocaleDateString('pt-BR')}
              </span>
            </span>
          )}
          <button onClick={toggleTvMode} style={{
            background: tvMode ? 'transparent' : TEAL,
            color: tvMode ? '#6b7280' : '#fff',
            border: tvMode ? '1px solid #374151' : 'none',
            borderRadius: 6, padding: '0 16px', height: 36,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {tvMode ? <><MonitorOff size={14} /> Sair do Modo TV</> : <><Monitor size={14} /> Modo TV</>}
          </button>
        </div>
      </div>

      {/* ── Board ── */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        padding: tvMode ? '20px 20px' : '16px',
        display: 'flex',
        gap: tvMode ? 14 : 10,
        alignItems: 'flex-start',
      }}>
        {statuses.map(st => {
          const colCards = cards.filter(c => c.status === st.id)
          return (
            <div key={st.id} style={{
              minWidth: tvMode ? 230 : 195,
              width: tvMode ? 230 : 195,
              flexShrink: 0,
            }}>
              <div style={{
                background: st.bg,
                border: `1px solid ${st.color}44`,
                borderTop: `3px solid ${st.color}`,
                borderRadius: '8px 8px 0 0',
                padding: tvMode ? '10px 14px' : '8px 10px',
                marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: tvMode ? 13 : 11, fontWeight: 800,
                  color: st.color, lineHeight: 1.3,
                }}>
                  {st.emoji} {st.label}
                </span>
                <span style={{
                  background: colCards.length > 0 ? st.color : '#d1d5db',
                  color: '#fff', borderRadius: '50%',
                  width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>
                  {colCards.length}
                </span>
              </div>

              <div style={{ minHeight: 80 }}>
                {colCards.map(card => (
                  <Card
                    key={card.id}
                    card={card}
                    tvMode={tvMode}
                    settings={settings}
                    statuses={statuses}
                    onClick={() => { if (!tvMode) setSelected(card) }}
                    onRemove={() => removeCard(card.id)}
                  />
                ))}
                {colCards.length === 0 && (
                  <div style={{
                    border: '1.5px dashed #1e293b',
                    borderRadius: 8, height: 70,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#334155', fontSize: 11,
                  }}>
                    vazio
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Modal configurações ── */}
      {modalSettings && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setModalSettings(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
            boxShadow: '0 24px 80px rgba(0,0,0,0.4)', overflow: 'hidden',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ background: NAVY, color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} /> Configurações do Painel
              </div>
              <button onClick={() => setModalSettings(false)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f9fafb', flexShrink: 0 }}>
              {(['timing', 'statuses'] as const).map(tab => (
                <button key={tab} onClick={() => setSettingsTab(tab)} style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  borderBottom: settingsTab === tab ? `2px solid ${NAVY}` : '2px solid transparent',
                  color: settingsTab === tab ? NAVY : '#6b7280',
                }}>
                  {tab === 'timing' ? '⏱ Temporização' : '📋 Status'}
                </button>
              ))}
            </div>

            {/* Tab: Temporização */}
            {settingsTab === 'timing' && (
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NAVY, marginBottom: 8 }}>
                    🔄 ATUALIZAR TELA A CADA
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[15, 30, 60, 120, 300].map(s => (
                      <button key={s} onClick={() => setDraft(d => ({ ...d, refreshSeconds: s }))}
                        style={{
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          background: draft.refreshSeconds === s ? NAVY : '#f3f4f6',
                          color: draft.refreshSeconds === s ? '#fff' : '#374151',
                          border: `2px solid ${draft.refreshSeconds === s ? NAVY : '#e5e7eb'}`,
                        }}>
                        {s < 60 ? `${s}s` : `${s / 60}min`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>
                    ⏰ ALERTA ATENÇÃO — veículo parado há mais de:
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                    Card fica com borda laranja pulsante
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[30, 60, 90, 120, 180].map(m => (
                      <button key={m} onClick={() => setDraft(d => ({ ...d, alertMinutes: m }))}
                        style={{
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          background: draft.alertMinutes === m ? '#f59e0b' : '#f3f4f6',
                          color: draft.alertMinutes === m ? '#fff' : '#374151',
                          border: `2px solid ${draft.alertMinutes === m ? '#f59e0b' : '#e5e7eb'}`,
                        }}>
                        {m < 60 ? `${m}min` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                    ⚠ ALERTA CRÍTICO — veículo parado há mais de:
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                    Card fica com borda vermelha pulsante + badge "ATRASADO"
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[60, 120, 180, 240, 480].map(m => (
                      <button key={m} onClick={() => setDraft(d => ({ ...d, alertCritMinutes: m }))}
                        style={{
                          padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          background: draft.alertCritMinutes === m ? '#ef4444' : '#f3f4f6',
                          color: draft.alertCritMinutes === m ? '#fff' : '#374151',
                          border: `2px solid ${draft.alertCritMinutes === m ? '#ef4444' : '#e5e7eb'}`,
                        }}>
                        {m < 60 ? `${m}min` : `${m / 60}h`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', border: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280' }}>
                  <b style={{ color: NAVY }}>Resumo:</b> tela atualiza a cada <b style={{ color: NAVY }}>{draft.refreshSeconds < 60 ? `${draft.refreshSeconds} segundos` : `${draft.refreshSeconds / 60} minuto(s)`}</b> · alerta atenção após <b style={{ color: '#d97706' }}>{draft.alertMinutes}min</b> · alerta crítico após <b style={{ color: '#ef4444' }}>{draft.alertCritMinutes}min</b>
                </div>
              </div>
            )}

            {/* Tab: Status */}
            {settingsTab === 'statuses' && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                  Renomeie, reordene ou crie colunas do painel. Status marcado como "sem alerta" não gera destaque de atraso.
                </div>

                {draftStatuses.map((st, idx) => (
                  <div key={st.id} style={{
                    border: '1px solid #e5e7eb', borderRadius: 8,
                    padding: '10px 12px', background: '#fafafa',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {/* Linha 1: emoji + label + deletar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        value={st.emoji}
                        onChange={e => updateDraftStatus(st.id, { emoji: e.target.value })}
                        maxLength={2}
                        style={{
                          width: 36, textAlign: 'center', fontSize: 18,
                          border: '1px solid #d1d5db', borderRadius: 6, padding: '4px',
                          background: '#fff',
                        }}
                        title="Emoji do status"
                      />
                      <input
                        value={st.label}
                        onChange={e => updateDraftStatus(st.id, { label: e.target.value })}
                        style={{
                          flex: 1, fontSize: 13, fontWeight: 600,
                          border: '1px solid #d1d5db', borderRadius: 6,
                          padding: '6px 10px', color: NAVY, background: '#fff',
                        }}
                        placeholder="Nome do status"
                      />
                      <span style={{
                        fontSize: 10, color: '#9ca3af', minWidth: 20, textAlign: 'center',
                      }}>
                        #{idx + 1}
                      </span>
                      <button
                        onClick={() => deleteDraftStatus(st.id)}
                        title="Excluir status"
                        style={{
                          background: 'transparent', border: '1px solid #fca5a5',
                          borderRadius: 6, padding: '4px 7px', cursor: 'pointer', color: '#ef4444',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Linha 2: paleta de cores + sem alerta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {COLOR_PALETTE.map((p, pi) => (
                          <button
                            key={pi}
                            onClick={() => updateDraftStatus(st.id, { color: p.color, bg: p.bg })}
                            title={p.color}
                            style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: p.color, border: st.color === p.color
                                ? '2px solid #111'
                                : '2px solid transparent',
                              cursor: 'pointer', padding: 0, flexShrink: 0,
                            }}
                          />
                        ))}
                      </div>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 11, color: '#374151', cursor: 'pointer', marginLeft: 'auto',
                      }}>
                        <input
                          type="checkbox"
                          checked={st.semAlerta}
                          onChange={e => updateDraftStatus(st.id, { semAlerta: e.target.checked })}
                          style={{ cursor: 'pointer' }}
                        />
                        Sem alerta de atraso
                      </label>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addDraftStatus}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '10px', borderRadius: 8, cursor: 'pointer',
                    background: '#f0fdf4', color: '#16a34a',
                    border: '1.5px dashed #86efac', fontSize: 13, fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  <Plus size={14} /> Adicionar Status
                </button>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10, flexShrink: 0, borderTop: '1px solid #f3f4f6' }}>
              <button onClick={salvarSettings} style={{
                flex: 1, background: NAVY, color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                Salvar configurações
              </button>
              <button onClick={() => setModalSettings(false)} style={{
                background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db',
                borderRadius: 8, padding: '12px 16px', fontSize: 13, cursor: 'pointer',
              }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal alterar status ── */}
      {selected && !tvMode && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            zIndex: 100, display: 'flex',
            alignItems: 'flex-end', justifyContent: 'center', padding: 16,
          }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16,
              width: '100%', maxWidth: 520,
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
              overflow: 'hidden', marginBottom: 4,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header modal */}
            <div style={{ background: NAVY, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: 2 }}>
                  {selected.placa}
                </div>
                {selected.veiculo && (
                  <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
                    {selected.veiculo}{selected.cor ? ` · ${selected.cor}` : ''}{selected.motorista ? ` · ${selected.motorista}` : ''}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, display: 'flex', gap: 12 }}>
                  <span>⏱ Status atual: <b style={{ color: '#fff' }}>{formatDuration(selected.statusAtualizadoEm)}</b></span>
                  <span>🏁 Total: <b style={{ color: '#fff' }}>{formatDuration(selected.criadoEm)}</b></span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Botões de status */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
                MOVER PARA:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {statuses.map(st => {
                  const isCurrent = selected.status === st.id
                  return (
                    <button
                      key={st.id}
                      onClick={() => !isCurrent && changeStatus(selected.id, st.id)}
                      style={{
                        padding: '10px 12px', borderRadius: 8,
                        cursor: isCurrent ? 'default' : 'pointer',
                        background: isCurrent ? st.color : st.bg,
                        color: isCurrent ? '#fff' : st.color,
                        border: `2px solid ${st.color}`,
                        fontSize: 12, fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 6,
                        opacity: isCurrent ? 1 : 0.9,
                        transition: 'opacity 0.1s',
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{st.emoji}</span>
                      <span style={{ flex: 1, lineHeight: 1.2, textAlign: 'left' }}>{st.label}</span>
                      {isCurrent && <span style={{ fontSize: 9, opacity: 0.85 }}>✓ atual</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Histórico */}
            <div style={{ padding: '0 20px 12px' }}>
              <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                HISTÓRICO
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
                {selected.historico.map((h, i) => {
                  const st = statuses.find(s => s.id === h.status) ?? { emoji: '?', label: h.label, color: '#6b7280', bg: '#f3f4f6' }
                  const dur = h.saida
                    ? formatDuration(h.entrada, h.saida)
                    : `há ${formatDuration(h.entrada)}`
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '4px 10px', borderRadius: 6,
                      background: !h.saida ? st.bg : '#f9fafb',
                      border: `1px solid ${!h.saida ? st.color + '44' : '#f3f4f6'}`,
                    }}>
                      <span>{st.emoji}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, flex: 1 }}>{st.label}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{dur}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Remover */}
            <div style={{ padding: '0 20px 18px' }}>
              <button onClick={() => removeCard(selected.id)} style={{
                width: '100%', padding: '9px', borderRadius: 8, cursor: 'pointer',
                background: '#fff', color: '#ef4444',
                border: '1px solid #fca5a5', fontSize: 12, fontWeight: 600,
              }}>
                Remover do Kanban
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
