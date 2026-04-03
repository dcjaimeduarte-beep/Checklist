---
name: frontend-components
description: Cria ou estende componentes React no frontend seguindo as regras do projeto (reutilização, tema, tokens). Usa quando o utilizador pedir novo componente UI, botão, input, card, layout, ou refatoração para extrair componente partilhado. Palavras-chave: componente, UI, Button, Card, criar componente, extrair, variant, shadcn.
---

## Objetivo

Garantir que cada componente novo seja **consistente**, **reutilizável** e alinhado às regras em **`.cursor/rules/frontend/frontend-standards.mdc`** (fonte normativa). Esta skill resume o **fluxo**; o detalhe normativo continua na rule.

## Antes de escrever código

1. **Ler** (ou relembrar) **`.cursor/rules/frontend/frontend-standards.mdc`** e, para cores/AA/tipografia, **`.cursor/rules/design-system-standards.mdc`**.
2. **Procurar** em `frontend/src/components/` (sobretudo `ui/`) um componente que já resolva o caso com **props** (`variant`, `size`, `className`, `asChild`).
3. **Só criar ficheiro novo** se não existir primitivo adequado **ou** se a extensão com variantes for pior que um componente à parte (ex.: acessibilidade incompatível).

## Onde colocar ficheiros

| Pasta | Uso |
|-------|-----|
| `components/ui/` | Primitivos reutilizáveis (Button, Input, Card, …), base do design system leve. |
| `components/shared/` | Blocos compostos usados em várias features (quando não forem só “página”). |

## Implementação

- **Estilo:** classes semânticas do tema (`bg-card`, `text-primary`, `border-border`, …); **nunca** hex ou `bg-slate-*` solto para marca. Quando a API exigir cor em string → `import { Colors } from '@/constants/Colors'`.
- **Tipografia:** `text-sm`, `font-semibold`, etc., ou `Tokens` para libs; ver `Tokens.ts` e `applyTheme`.
- **Variantes:** preferir **CVA** (`class-variance-authority`) + `cn()` de `@/lib/utils` para `variant` / `size`, em linha com `Card` existente.
- **Props:** tipadas, defaults seguros; preferir **union de variantes** a muitos booleanos soltos.
- **Idioma:** nomes de símbolos e ficheiros em **inglês**; comentários em **português** quando úteis (`AGENTS.md`).
- **Acessibilidade:** HTML semântico, `aria-*` quando necessário, foco visível — **design-system-standards**.

## Checklist rápido

- [ ] Existe já algo em `components/ui/` que cobre isto?
- [ ] Cores só via tema / `Colors.ts`?
- [ ] Um único Button/Input/Card “família” com variants em vez de duplicar?
- [ ] Componente exportado de forma clara; props documentadas no tipo?

## Referência

- Regra principal: **`.cursor/rules/frontend/frontend-standards.mdc`**
- Design system / WCAG: **`.cursor/rules/design-system-standards.mdc`**
- UI/UX: **`.cursor/rules/design-ui-ux-standards.mdc`**
- Arquitetura: `frontend/docs/architecture/architecture.md`
