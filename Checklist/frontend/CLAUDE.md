# Frontend — CLAUDE.md

Instruções específicas para o frontend React.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · lucide-react · CVA · Radix Slot

## Páginas

| Página | Descrição |
|--------|-----------|
| **LoginPage** | Login com layout 50/50 (navy animado + form branco), card demo credentials |
| **ConsultPage** | Barra de busca inline + resultados com abas (Visão Geral, Tributação, Classificações, Estratégica) |
| **BatchPage** | Upload múltiplo de planilhas XLSX, drag-and-drop, lista com status e download |

Navegação via `usePage()` context (sem react-router, URL sempre `/`).

## Contexts (estado persistente)

| Context | Storage | Descrição |
|---------|---------|-----------|
| `AuthContext` | Cookie HttpOnly | Sessão JWT |
| `ConsultContext` | sessionStorage | NCM, regime, ano, resultado (sobrevive F5) |
| `BatchContext` | IndexedDB | Planilhas, blobs, status, resultados (sobrevive F5) |
| `PageContext` | memória | Página ativa (consulta/lote) |

## Componentes UI

- `components/ui/` — Button, Card, Input, Dropdown (customizado, não `<select>` nativo)
- `components/analysis/AnalysisViewDisplay.tsx` — Resultados com abas
- `components/AppLogo.tsx` — Logo Seven

## Design system

- Cores: `src/constants/Colors.ts` (fonte única de hex)
- Tipografia: `src/constants/Tokens.ts`
- Tema aplicado via `src/theme/applyTheme.ts` → CSS variables → Tailwind

## Regras de UI/UX

- Fundo branco para dados, sem cards escuros.
- Inputs `h-12`, labels `font-semibold text-foreground`.
- Placeholders visíveis: `placeholder:text-muted-foreground/60`.
- `cursor-pointer` em tudo que é clicável.
- Responsivo para mobile (grids 1→2→3 colunas).
- Abas para reduzir scroll.
- Animação gradient (orbs) na tela de login e área de resultados.
- Persistir estado entre navegações e F5.

## API (`src/lib/api.ts`)

- `loginRequest`, `logoutRequest`, `sessionMeRequest`
- `analyzeRequest(body)` → `AnalyzeResponse`
- `batchProcessRequest(file)` → `Blob` (XLSX enriquecido)
- Base URL via proxy Vite (`/api` → `localhost:3000`)

## Convenções

- Não implementar lógica fiscal — só exibir dados da API.
- Símbolos em inglês, textos UI em português BR.
- Usar `cn()` para compor classes Tailwind.
- Componentes com tipagem explícita de props.
