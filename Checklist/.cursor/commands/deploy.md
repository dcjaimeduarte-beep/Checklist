# /deploy

Integrar `develop` em `main` (release simples). **Apenas o descrito aqui** — sem CI/CD extra por agora.

## O que fazer

1. Garantir que não há alterações não commitadas (`git status`). Se houver, avisar o utilizador antes de continuar.

2. **Fetch** remoto: `git fetch origin`.

3. **Checkout `main`:** `git checkout main` e `git pull origin main` para estar atualizado.

4. **Merge de `develop` em `main`:** `git merge origin/develop` (ou `git merge develop` se a branch local existir e estiver atualizada). Resolver conflitos se aparecerem, com ajuda do utilizador se necessário.

5. **Push** de `main`: `git push origin main`.

6. O estado final desejado é **`main` atualizado no remoto** com o conteúdo integrado de `develop`. Opcionalmente informar que o desenvolvimento continua em `develop` com `git checkout develop` se o fluxo da equipa for esse.

7. Resposta **curta**: resultado do merge e do push, ou bloqueios (conflitos, permissões).

## Avisos

- Este fluxo **não** substitui pipelines de deploy em servidor; é apenas integração de branches.
- Exige permissões de push em `main` no remoto.
