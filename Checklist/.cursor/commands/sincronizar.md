Sincronizar o banco SQLite com os documentos de referência (LC 214, cClassTrib, NCM).

Use quando: primeira instalação, banco corrompido, documentos atualizados em `docs/`.

1. Verificar se `node_modules/` existe no backend, senão `npm install`
2. Rodar `npm run sync-db` na raiz do projeto
   - Se já tem dados: informar e perguntar se quer forçar
   - Para forçar: `npm run sync-db:force`
3. Verificar a saída: deve mostrar contagem de NCMs (~15.156), cClassTrib (~154) e LC 214 (blocos)
4. Se o PDF falhar (pdf-parse), informar que NCM e cClassTrib foram ingeridos normalmente
5. Após sincronizar, o servidor pode ser iniciado com `npm run dev` (sem FORCE_REINGEST)
