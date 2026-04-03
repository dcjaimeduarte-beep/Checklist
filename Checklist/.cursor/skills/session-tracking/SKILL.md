---
name: session-tracking
description: Gerenciamento de sessões de trabalho — ler contexto ao iniciar, atualizar logs em docs/sessions/ com o subagente docs-engineer. Palavras-chave: sessão, contexto, sessions, iniciar, retomar, docs-engineer.
---

## Visão geral

Esta skill define o **fluxo** de rastreamento de sessão (antes, durante e depois do trabalho). O detalhamento de política, formato e Git está em **`.cursor/rules/session-tracking.md`**.

## Referências cruzadas

| Documento | Papel |
|-----------|--------|
| `.cursor/rules/session-tracking.md` | Regras completas (localização, janela de leitura, conteúdo, versionamento). |
| `.cursor/agents/docs-engineer.md` | Subagente para redigir ou atualizar o arquivo do dia em `docs/sessions/`. |
| `AGENTS.md` (raiz) | Obrigatoriedade de seguir esta skill no repositório. |

## Ao iniciar uma conversa (obrigatório)

1. Listar arquivos em `docs/sessions/` ordenados por data.
2. Ler os **últimos 3 dias** de sessão (máximo **3 arquivos**).
3. Usar o contexto para retomar decisões e pendências; evitar perguntas redundantes.
4. Se não existir `docs/sessions/`, criar o diretório.

Para o passo a passo e restrições de conteúdo, ver **`.cursor/rules/session-tracking.md`**.

## Durante a conversa

Para **atualizar** o registro do dia **sem bloquear** o desenvolvimento, usar o subagente **`docs-engineer`** em background. O subagente aplica o formato e o tom definidos nas rules de session tracking (log conciso, não documentação de arquitetura).

Exemplo de invocação (ajustar data e prompt ao contexto):

```text
Subagente: docs-engineer (background)
Prompt: Atualizar docs/sessions/YYYY-MM-DD.md com: [resumo do que fechar neste marco — decisões, mudanças, pendências]
```

1. Arquivo do dia: `docs/sessions/yyyy-mm-dd.md`.
2. Se já houver blocos no dia, acrescentar `## Sessão N — HH:MM` conforme `.cursor/rules/session-tracking.md`.
3. Disparar nos **marcos** descritos nas rules (feature, bug, arquitetura, deploy, validação, PR, etc.).
4. **Nunca** pausar o desenvolvimento só para escrever a sessão — preferir execução em paralelo quando a ferramenta permitir.

## Formato do conteúdo

O template e o que incluir ou excluir estão centralizados em **`.cursor/rules/session-tracking.md`** (inclui exemplo de bloco `## Sessão N`).

## Regras resumidas

- Um arquivo por dia; várias sessões no mesmo arquivo quando necessário.
- `docs/sessions/` é **local** (listado no `.gitignore`); não commitar.
- Janela de leitura: últimos 3 dias apenas (evitar sobrecarga de contexto).
