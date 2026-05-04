Execute o fluxo completo de git para o projeto Enviardocs:

1. Rode `git status` para ver todos os arquivos modificados/novos.

2. Rode `git diff` para ver as mudanças em detalhe.

3. Analise as mudanças e proponha uma mensagem de commit clara e descritiva seguindo o padrão Conventional Commits:
   - `feat:` nova funcionalidade
   - `fix:` correção de bug
   - `refactor:` refatoração sem mudança de comportamento
   - `docs:` documentação
   - `test:` testes
   - `chore:` configuração, build, etc.

4. **Antes de commitar**, verifique se há arquivos sensíveis sendo commitados (.env, senhas, tokens). Se houver, alerte o usuário e NÃO os inclua.

5. Adicione os arquivos relevantes (nunca `git add -A` sem revisar).

6. Crie o commit com a mensagem proposta.

7. Pergunte ao usuário se deseja fazer `git push` antes de executar.

8. Se confirmado, execute `git push`.
