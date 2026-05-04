Inicie os servidores de desenvolvimento do projeto Enviardocs seguindo estas etapas:

1. Verifique se o arquivo `backend/.env` existe. Se não existir, avise o usuário para copiar `backend/.env.example` e preencher os valores antes de continuar.

2. Inicie o servidor **backend** em background:
   - Diretório: `backend/`
   - Comando: `npm run dev`
   - Porta esperada: 3000

3. Inicie o servidor **frontend** em background:
   - Diretório: `frontend/`
   - Comando: `npm run dev`
   - Porta esperada: 5173

4. Aguarde alguns segundos e confirme que ambos subiram sem erro.

5. Informe ao usuário:
   - Backend: http://localhost:3000
   - Frontend: http://localhost:5173
   - Health check: http://localhost:3000/health
