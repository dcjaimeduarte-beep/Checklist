Encerre os servidores de desenvolvimento do projeto Enviardocs seguindo estas etapas:

1. Identifique e encerre o processo rodando na porta **3000** (backend):
   - Windows: `netstat -ano | findstr :3000` para encontrar o PID, depois `taskkill /PID <pid> /F`
   - Linux/Mac: `lsof -ti:3000 | xargs kill -9`

2. Identifique e encerre o processo rodando na porta **5173** (frontend):
   - Windows: `netstat -ano | findstr :5173` depois `taskkill /PID <pid> /F`
   - Linux/Mac: `lsof -ti:5173 | xargs kill -9`

3. Confirme que as portas estão livres.

4. Informe ao usuário que os servidores foram encerrados.

Adapte os comandos ao sistema operacional detectado (process.platform ou verificando o shell disponível).
