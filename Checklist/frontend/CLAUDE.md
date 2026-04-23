# Frontend — CLAUDE.md (Checklist Automotivo)

Instruções específicas para o frontend do sistema de checklist de vistoria veicular.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Lucide React · html2canvas · jsPDF

## Páginas

| Página | Arquivo | Descrição |
|--------|---------|-----------|
| **ChecklistPage** | `src/pages/ChecklistPage.tsx` | Página principal — checklist completo, fotos, modal salvar, PDF |
| **HistoricoPage** | `src/pages/HistoricoPage.tsx` | Histórico de vistorias por placa |
| **KanbanPage** | `src/pages/KanbanPage.tsx` | Painel Kanban da oficina — abre em aba própria via `/?kanban` |

Navegação via `useState` em `App.tsx` — sem react-router. URL sempre `/`.

```typescript
// App.tsx — lógica de roteamento
const IS_KANBAN = new URLSearchParams(window.location.search).has('kanban')
// IS_KANBAN → renderiza KanbanPage isolado (aba dedicada)
// pagina === 'historico' → HistoricoPage
// padrão → ChecklistPage
```

## ChecklistPage — seções

1. **Dados do Veículo** — Marca, Modelo, Ano, Placa, KM, Data, Descrição
2. **Dados do Motorista** — Nome, Fone, CNH, Categoria, Vencimento
3. **Itens Inspecionados** — 20 itens, 2 colunas, 3 estados: BOM / RUIM / N.FUNC (classe `.print-only` — ocultos na tela, visíveis no PDF)
4. **Avarias** — SVG clicável do veículo; marcações: (A) Amassado / (R) Riscado / (X) Quebrado / (F) Faltante
5. **Fotos da Vistoria** — câmera nativa (`capture="environment"`), thumbnails, remover
6. **Assinaturas** — Responsável, Motorista, Data, Aprovado por

## PDF (html2canvas + jsPDF)

Gerado via `gerarPdfBlob()` usando `html2canvas` com callback `onclone`:

- `<input>` substituídos por `<span>` com `.value` atual (html2canvas não captura estado React)
- `<textarea>` substituídos por `<div>` com `.value` atual
- Elementos `.print-only` recebem `display: flex !important` (ficam ocultos na tela via `@media screen`)
- `.fotos-print-visible/.fotos-print-hidden` controlados via `printComFotos` flag

## KanbanPage — arquitetura

- Conexão SSE em `/api/kanban/eventos` — recebe `init`, `card_added`, `card_updated`, `card_removed`
- Auto-reconexão com timeout de 3s em caso de erro
- **Statuses configuráveis** — interface `StatusConfig { id, label, emoji, color, bg, semAlerta }`
  - 9 statuses padrão em `DEFAULT_STATUSES`
  - Persiste em `localStorage` via `loadStatuses()`/`saveStatuses()`
- **Configurações de temporização** — `KanbanSettings { refreshSeconds, alertMinutes, alertCritMinutes }`
  - Persiste em `localStorage` via `loadSettings()`/`saveSettings()`
- **Modo TV** — fullscreen, relógio, desabilita interações
- **Alertas** — CSS `@keyframes pulse-warn` (laranja) e `pulse-crit` (vermelho) acionados por `semAlerta: false` + tempo no status
- **Aba própria** — `window.open('/?kanban', '_blank')` mantém checklist e kanban isolados

## Modal Configurações (KanbanPage)

Duas abas:
- **⏱ Temporização** — refresh interval, limiar de alerta atenção/crítico
- **📋 Status** — renomear, trocar emoji, trocar cor (paleta de 12), toggle "sem alerta", excluir, adicionar novo

## Proxy Vite (dev)

`/api` → `http://localhost:3001` (v2 dev)

## Convenções

- Sem react-router — navegação por state em App.tsx.
- Inline styles para tudo (sem Tailwind nas páginas principais — Tailwind só em componentes base se necessário).
- Cores da marca: `NAVY = '#13293D'`, `TEAL = '#3E7080'`.
- `npx tsc --noEmit` deve passar limpo após qualquer edição.
