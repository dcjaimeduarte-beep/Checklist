import { useState } from 'react'
import ChecklistPage from '@/pages/ChecklistPage'
import HistoricoPage from '@/pages/HistoricoPage'

type Pagina = 'checklist' | 'historico'

function App() {
  const [pagina, setPagina] = useState<Pagina>('checklist')

  if (pagina === 'historico') {
    return <HistoricoPage onVoltar={() => setPagina('checklist')} />
  }
  return <ChecklistPage onHistorico={() => setPagina('historico')} />
}

export default App
