---
description: Política de rastreamento de sessões — arquivos em docs/sessions/, janela de leitura, atualização via subagente docs-engineer, formato e Git.
---

# Session tracking

Registro **local** de sessões de trabalho para preservar contexto entre conversas. Cada pessoa mantém os próprios arquivos; **não** entram no Git.

## Documentos relacionados

| Artefato | Função |
|----------|--------|
| `.cursor/skills/session-tracking/SKILL.md` | Workflow: o que fazer ao **iniciar** a conversa e **quando** atualizar o log. |
| `.cursor/agents/docs-engineer.md` | Subagente que **redige** o Markdown do dia (tom técnico conciso; neste uso, seguir esta rule, não ADR). |

## Objetivo

Evitar perda de decisões e pendências quando o contexto da IA é compactado. O arquivo diário é um **resumo operacional**, não substitui ADRs nem `docs/` de produto.

## Localização e nomenclatura

```
docs/sessions/yyyy-mm-dd.md
```

- Um arquivo **por dia** (ex.: `2026-03-31.md`).
- Várias interrupções no mesmo dia → **um arquivo**, novos blocos `## Sessão N — HH:MM` (ver [Formato](#formato)).
- Se `docs/sessions/` não existir, **criar** o diretório.

## Janela de leitura ao iniciar

Ler os arquivos mais recentes em `docs/sessions/` correspondentes aos **últimos 3 dias** (no máximo **3 arquivos**). Para histórico mais antigo, o usuário pede explicitamente.

## Atualização (em background)

Não interromper o fluxo principal de implementação só para atualizar o log.

1. Usar o subagente **`docs-engineer`** em background com um prompt explícito: path `docs/sessions/yyyy-mm-dd.md`, fatos a registrar (decisões, mudanças, pendências).
2. O subagente deve seguir o [Formato](#formato) abaixo e manter linguagem **concisa** (não expandir para documentação de arquitetura salvo pedido separado).

Referência de invocação (adaptar à UI do Cursor / Claude Code):

```text
Subagente: docs-engineer (run_in_background=true)
Prompt: Atualizar docs/sessions/YYYY-MM-DD.md com: [bullet points ou parágrafo curto]
```

## Marcos que disparam atualização

- Funcionalidade nova concluída ou entregue em parte relevante.
- Bug identificado ou corrigido.
- Mudança de arquitetura ou de regra de negócio/documentada.
- Deploy ou release.
- Validação de dados (resultado esperado vs obtido).
- PR aberta ou mergeada.
- Qualquer ponto que alguém precise lembrar **no dia seguinte** para continuar o trabalho.

## Conteúdo

**Incluir:** decisões e **por quê**; o que foi feito (PR, deploy, fix); pendências; bloqueios e desbloqueios; validações relevantes.

**Evitar:** lista de comandos; linha a linha de código; saídas longas de query ou log; o que já está claro no Git.

## Formato

```markdown
## Sessão 1 — HH:MM

### Contexto
Uma frase sobre o que estava em andamento.

### Decisões
- Decisão X — motivo Y

### Mudanças
- Descrição breve (PR #N, branch, deploy se aplicável)

### Pendências
- Itens que bloqueiam ou seguem para a próxima sessão
```

Sessões adicionais no mesmo dia: `## Sessão 2 — HH:MM`, etc.

## Responsabilidades do assistente

1. **Ao iniciar:** ler a janela de 3 dias (skill).
2. **Durante:** disparar `docs-engineer` nos marcos acima quando fizer sentido.
3. **Ao encerrar:** garantir que pendências do dia estão refletidas no arquivo (se houver ferramenta para edição final).

## Git

- `docs/sessions/` está no **`.gitignore`** — não commitar entradas de sessão.
- **Este arquivo** (`.cursor/rules/session-tracking.md`) e a **skill** são versionados como referência da equipe.
