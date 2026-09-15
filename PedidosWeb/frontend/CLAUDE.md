# Frontend — CLAUDE.md

Instruções específicas para o frontend React do sistema AnaliseSped.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · lucide-react · CVA · recharts

## Propósito

Interface para confronto de **SPED Fiscal x XMLs de NF-e/CT-e**:
1. Upload do arquivo SPED + seleção da pasta de XMLs
2. Visualização dos resultados (divergências) em tabelas
3. Download do relatório (Excel/PDF) e envio por e-mail

## Páginas

| Página | Descrição |
|--------|-----------|
| **LoginPage** | Login com layout 50/50 (navy animado + form branco) |
| **UploadPage** | Upload do SPED + seleção de pasta XML + botão "Confrontar" |
| **ResultsPage** | Resultados: resumo cards + duas tabelas de divergências + ações |

Navegação via `PageContext` (sem react-router, URL sempre `/`).

## Contexts (estado persistente)

| Context | Storage | Descrição |
|---------|---------|-----------|
| `AuthContext` | Cookie HttpOnly | Sessão JWT |
| `ConfrontContext` | sessionStorage | SessionId atual, resultado do confronto, status upload |
| `PageContext` | memória | Página ativa (upload / results) |

## Componentes novos

- `components/confront/SpedDropzone.tsx` — Drag-and-drop para arquivo SPED .txt
- `components/confront/XmlFolderPicker.tsx` — Seleção de pasta XML (webkitdirectory)
- `components/confront/SummaryCards.tsx` — Cards com totais do confronto
- `components/confront/DivergenceTable.tsx` — Tabela reutilizável de divergências
- `components/confront/ActionBar.tsx` — Botões Download Excel/PDF e Enviar E-mail

## Componentes UI existentes (manter)

- `components/ui/` — Button, Card, Input
- `components/AppLogo.tsx` — Logo

## Design system

- Cores: `src/constants/Colors.ts`
- Tipografia: `src/constants/Tokens.ts`
- Tema: `src/theme/applyTheme.ts` → CSS variables → Tailwind

## Regras de UI/UX

- Fundo branco para dados, sem cards escuros.
- Inputs `h-12`, labels `font-semibold text-foreground`.
- `cursor-pointer` em tudo que é clicável.
- Responsivo para mobile (grids 1→2→3 colunas).
- Barra de progresso durante upload/processamento.
- Estado vazio elegante quando não há divergências (ícone + texto).
- Tabelas com paginação se > 50 linhas.
- Badge colorido na coluna "Situação" (verde=regular, amarelo=cancelado, vermelho=denegado).

## API (`src/lib/api.ts`)

- `loginRequest(body)` → cookie JWT
- `logoutRequest()`
- `confrontRequest(spedFile, xmlFiles)` → `ConfrontResultDto` + sessionId
- `getConfrontResult(sessionId)` → `ConfrontResultDto`
- `downloadExcel(sessionId)` → Blob
- `downloadPdf(sessionId)` → Blob
- `sendEmail(sessionId, to, message?)` → void

Base URL via proxy Vite (`/api` → `localhost:3000`).

## Types (`src/types/confront.ts`)

```ts
interface SpedInfo { cnpj; nome; dtIni; dtFin; uf; }
interface XmlItem { chave; filename; nNF?; serie?; dhEmi?; cnpjEmit?; xNomeEmit?; vNF?; tipo; }
interface SpedItem { chave; numDoc?; ser?; dtDoc?; codMod?; codSit?; indOper?; }
interface ConfrontResultDto {
  sessionId; createdAt; spedFilename; spedInfo: SpedInfo;
  totalSpedEntries; totalXmls; totalMatches;
  xmlsNotInSped: XmlItem[];
  spedNotInXml: SpedItem[];
}
```

## Convenções

- Não implementar lógica fiscal — só exibir dados da API.
- Símbolos em inglês, textos UI em português BR.
- Usar `cn()` para compor classes Tailwind.
- Componentes com tipagem explícita de props.
- Feedback visual em todas as ações assíncronas (loading, erro, sucesso).
