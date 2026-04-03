# /git

Registar alterações e enviar para o remoto, alinhado à política do repositório.

## O que fazer

1. Atuar como o subagente **`.cursor/agents/github-specialist.md`** e seguir **`.cursor/rules/github-standards.mdc`**:
   - `git status` para ver o que mudou.
   - `git add .` (ou ficheiros específicos se o utilizador pedir o contrário).
   - **`git commit -m "..."`** com mensagem **Conventional Commits**: tipo e escopo em **inglês**, descrição em **português** (ex.: `feat(frontend): adicionar validação do formulário`).
   - Se fizer falta corpo no commit, usar mensagem multi-linha com contexto em português.
   - `git push` para o branch atual (confirmar branch com `git branch --show-current`).

2. **Não** fazer push para `main` com trabalho experimental se a política for desenvolver em `develop` — avisar o utilizador se o branch for inadequado.

3. Resposta **curta**: branch, hash ou mensagem do commit, e resultado do push.
