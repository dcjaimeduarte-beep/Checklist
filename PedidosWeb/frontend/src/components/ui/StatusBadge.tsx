import { cn } from '@/lib/utils'
import type { PedidoStatus } from '@/types/pedido'

const CONFIG: Record<PedidoStatus, { label: string; cls: string }> = {
  RASCUNHO:     { label: 'Rascunho',     cls: 'bg-gray-100 text-gray-600 ring-gray-200' },
  PENDENTE:     { label: 'Pendente',     cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  TRANSMITINDO: { label: 'Transmitindo', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  CONFIRMADO:   { label: 'Confirmado',   cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ERRO:         { label: 'Erro ERP',     cls: 'bg-red-50 text-red-700 ring-red-200' },
  CANCELADO:    { label: 'Cancelado',    cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
}

export function StatusBadge({ status }: { status: PedidoStatus }) {
  const { label, cls } = CONFIG[status] ?? CONFIG.RASCUNHO
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
        cls,
      )}
    >
      {label}
    </span>
  )
}
