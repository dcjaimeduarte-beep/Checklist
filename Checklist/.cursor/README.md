# Configuração Cursor — este repositório

Este diretório agrupa **rules** (regras do projeto), **skills** (fluxos reutilizáveis) e **agents** (subagentes com prompt dedicado). Cada camada tem papel distinto:

| Camada | Caminho | Função |
|--------|---------|--------|
| **Rules** | `.cursor/rules/` | Política e detalhamento — o que fazer, limites, formato. Aplicam-se ao assistente no contexto do projeto. |
| **Skills** | `.cursor/skills/<nome>/SKILL.md` | Workflow operacional: quando disparar, passos obrigatórios, atalhos. Referencia as rules e os agents quando couber. |
| **Agents** | `.cursor/agents/<nome>.md` | Subagente: prompt de sistema para tarefas isoladas (ex.: documentação técnica ou atualização de sessão em background). |
| **Commands** | `.cursor/commands/<nome>.md` | Comandos `/nome` no chat — instruções para o agente (dev local, git, review, deploy). |

## Comandos slash (`/`)

| Comando | Ficheiro | Função |
|---------|----------|--------|
| `/iniciar-dev` | `commands/iniciar-dev.md` | Se não houver `node_modules` na raiz → `npm install`; senão saltar; ver portas; `npm run dev` se preciso; mostrar URLs `8080` / `3000`. |
| `/fechar-dev` | `commands/fechar-dev.md` | Parar processos nas portas de dev (`8080`, `3000`). |
| `/review` | `commands/review.md` | Revisão alinhada ao subagente `code-review`. |
| `/git` | `commands/git.md` | add / commit / push com `github-specialist` e `github-standards`. |
| `/deploy` | `commands/deploy.md` | Merge `develop` → `main` e push (fluxo simples). |

## Session tracking (sessões de trabalho)

| Artefato | Descrição |
|----------|-----------|
| `.cursor/skills/session-tracking/SKILL.md` | Skill: leitura inicial de contexto, quando atualizar, invocação do subagente. |
| `.cursor/rules/session-tracking.md` | Rules: formato do arquivo diário, janela de leitura, git, marcos. |
| `.cursor/agents/docs-engineer.md` | Subagente usado para **editar** `docs/sessions/yyyy-mm-dd.md` sem bloquear o fluxo principal (ver skill). |
| `docs/sessions/` | Saída local (`.gitignore`) — não versionar. |

**Ordem de leitura sugerida:** `AGENTS.md` → skill → rules → subagent, se precisar do detalhe do prompt.

**Domínio reforma tributária:** `AGENTS.md` (secção fontes) → `.cursor/rules/domain/tax-reform-sources.mdc` (pipeline do produto) + `.cursor/rules/domain/ncm-reforma-trusted-sources.mdc` (fontes web confiáveis e lógica NCM + reforma) → `.cursor/skills/tax-reform-lookup/SKILL.md`; backend alinha com `backend-specialist` e `nest-workflow`; frontend (login + cards) com `frontend-specialist` e design rules.

## Skills (projeto)

| Skill | Pasta |
|-------|--------|
| Session tracking | `.cursor/skills/session-tracking/SKILL.md` |
| Componentes frontend | `.cursor/skills/frontend/frontend-components/SKILL.md` |
| Nest / features backend | `.cursor/skills/backend/nest-workflow/SKILL.md` |
| Reforma tributária / LC 214 / NCM / Siscomex | `.cursor/skills/tax-reform-lookup/SKILL.md` |

## Subagentes (projeto)

| Agente | Ficheiro |
|--------|----------|
| Documentação / sessões | `.cursor/agents/docs-engineer.md` |
| Git / GitHub (`github-standards`) | `.cursor/agents/github-specialist.md` |
| Frontend (React, Tailwind, rules `frontend/`) | `.cursor/agents/frontend-specialist.md` |
| Revisão de código (objetiva, repo-aware) | `.cursor/agents/code-review.md` |
| Backend NestJS (API, TypeORM, regras `backend/`) | `.cursor/agents/backend-specialist.md` |

## Outras rules

| Arquivo | Escopo |
|---------|--------|
| `.cursor/rules/frontend/frontend-standards.mdc` | `frontend/**/*` — tema, reutilização de componentes; remete ao design system. |
| `.cursor/rules/design-system-standards.mdc` | `frontend/**/*` — WCAG 2.1 AA, paleta e tipografia (espelho de Colors / Tokens). |
| `.cursor/rules/design-ui-ux-standards.mdc` | `frontend/**/*` — UI/UX moderna, minimalista, profissional; dashboards; complementa o design system. |
| `.cursor/rules/github-standards.mdc` | Sempre — commits convencionais (prefixos EN, texto PT); branches `main` / `develop`. |
| `.cursor/rules/backend/backend-standards.mdc` | `backend/**/*` — NestJS, TypeORM, SQLite, DTOs, camadas. |
| `.cursor/rules/domain/tax-reform-sources.mdc` | Sempre — ordem LC 214 → cClassTrib → NCM → Siscomex; cache SQLite; scraping no backend. |
| `.cursor/rules/domain/ncm-reforma-trusted-sources.mdc` | Sempre — oficiais vs facilitadores na web; TIPI/NF-e; NCM + LC 214 + cClassTrib (não confundir com o pipeline em `tax-reform-sources`). |
