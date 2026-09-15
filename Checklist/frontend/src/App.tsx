import { useState } from 'react'
import ChecklistPage  from '@/pages/ChecklistPage'
import HistoricoPage  from '@/pages/HistoricoPage'
import KanbanPage     from '@/pages/KanbanPage'
import RelatoriosPage from '@/pages/RelatoriosPage'

// Kanban abre em aba própria via /?kanban
const IS_KANBAN = new URLSearchParams(window.location.search).has('kanban')

type Pagina = 'checklist' | 'historico' | 'relatorios'

function App() {
  const [pagina, setPagina] = useState<Pagina>('checklist')

  // Aba dedicada do kanban
  if (IS_KANBAN) return <KanbanPage onVoltar={() => window.close()} />

  if (pagina === 'historico') return <HistoricoPage onVoltar={() => setPagina('checklist')} />

  if (pagina === 'relatorios') return <RelatoriosPage onVoltar={() => setPagina('checklist')} />

  return (
    <ChecklistPage
      onHistorico={() => setPagina('historico')}
      onKanban={() => window.open('/?kanban', '_blank')}
      onRelatorios={() => setPagina('relatorios')}
    />
  )
}

export default App
