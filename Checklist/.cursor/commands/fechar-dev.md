# /fechar-dev

Parar servidores de desenvolvimento local que estejam a usar as portas do monorepo.

## O que fazer

1. Identificar processos que escutam nas portas:
   - **8080** (Vite / frontend)
   - **3000** (Nest / backend; respeitar `PORT` se o utilizador alterou — por defeito 3000)

2. No **macOS**, podes usar (com cuidado):
   - `lsof -ti:8080` / `lsof -ti:3000` para obter PIDs, depois `kill` (preferir `SIGTERM` antes de forçar).

3. **Não** matar processos que não sejam claramente o dev server (se houver dúvida, listar PID e comando ao utilizador antes de terminar).

4. Confirmar no fim que as portas ficaram livres ou reportar o que falhou.

5. Resposta **curta**: o que foi encerrado e em que portas.
