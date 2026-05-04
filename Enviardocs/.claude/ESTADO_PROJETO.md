# Estado do Projeto — Enviardocs

> Este documento é a fonte de verdade para o Claude Code.
> Atualizar com `/atualizar-sessao` ou escrevendo "Atualizar sessao de ajustes".
> **Nunca substituir rotas, serviços ou arquivos listados aqui sem confirmar com o usuário.**
> **Antes de alterar qualquer tela ou estilo, ler `.claude/IDENTIDADE_VISUAL.md`.**

---

## Última atualização
2026-05-03

---

## Estrutura de pastas

```
Enviardocs/
├── .claude/
│   ├── commands/
│   │   ├── iniciar-dev.md
│   │   ├── fechar-dev.md
│   │   ├── git.md
│   │   └── atualizar-sessao.md
│   ├── ESTADO_PROJETO.md       ← este arquivo
│   └── IDENTIDADE_VISUAL.md    Tokens de marca Seven (não alterar sem aprovação)
├── docs/
│   └── Controle financeiro.xlsx  Planilha de clientes (fonte do banco de dados)
├── backend/
│   ├── data/
│   │   └── enviardocs.db         SQLite — clientes, emails, logs de envio
│   ├── diag.js                   Script diagnóstico temporário (pode remover)
│   ├── src/
│   │   ├── app.ts                Express: helmet, cors, rate limit (skip /health), rotas, /api/status
│   │   ├── server.ts             Ponto de entrada — porta 3000 + handlers uncaughtException/unhandledRejection
│   │   ├── config/
│   │   │   ├── env.ts            Variáveis de ambiente com required() / optional()
│   │   │   ├── email.template.ts Template assunto/corpo do e-mail editável via tela Configurações
│   │   │   └── logger.ts         Re-exporta utils/logger (compatibilidade)
│   │   ├── controllers/
│   │   │   ├── envio.controller.ts    preview + envio individual + lote (STORAGE_DIR) + buscarJaEnviados
│   │   │   ├── upload.controller.ts   Envio via upload do browser (multipart) com consolidação por e-mail
│   │   │   ├── cliente.controller.ts  CRUD + listarInativos + ativarCliente + importarClientes
│   │   │   ├── config.controller.ts   GET/PUT template de e-mail (assunto e corpo)
│   │   │   └── [legados]             clientController.ts, sendDocsController.ts
│   │   ├── database/
│   │   │   ├── db.ts             Singleton SQLite (WAL mode, foreign keys ON)
│   │   │   ├── schema.ts         Migrations: clients, client_emails, send_log, config
│   │   │   └── clientRepository.ts   Queries brutas do banco
│   │   ├── middlewares/
│   │   │   ├── apiKey.middleware.ts   timingSafeEqual — nunca timing attack
│   │   │   ├── error.middleware.ts    Mapeia erros customizados → HTTP codes
│   │   │   ├── validate.middleware.ts Zod schema validation
│   │   │   └── [legados]             authMiddleware.ts, errorHandler.ts
│   │   ├── routes/
│   │   │   ├── envio.routes.ts   GET /preview, GET /enviados, POST /cliente, POST /lote, POST /lote-upload
│   │   │   ├── cliente.routes.ts GET / GET /inativos GET /buscar GET /:id GET /:id/historico
│   │   │   │                     POST / POST /importar PUT /:id PUT /:id/ativar DELETE /:id
│   │   │   ├── config.routes.ts  GET /template, PUT /template
│   │   │   └── [legados]         docs.ts, clients.ts
│   │   ├── services/
│   │   │   ├── arquivo.service.ts   Localiza arquivos, renomeia com _ok após envio
│   │   │   ├── email.service.ts     Nodemailer — aceita path ou buffer (upload)
│   │   │   ├── cliente.service.ts   CRUD + registrarEnvio + foiEnviado + jaEnviadosNoMes + ativarCliente + listarInativos
│   │   │   ├── import.service.ts    Importação de clientes via planilha xlsx
│   │   │   └── [legados]            emailService.ts, fileService.ts, clientService.ts
│   │   ├── utils/
│   │   │   ├── nome.util.ts      normalizarNome() — remove acentos, normaliza para busca
│   │   │   ├── path.util.ts      criarCaminhoSeguro() — bloqueia path traversal
│   │   │   └── logger.ts         logInfo / logError com timestamp
│   │   └── validations/
│   │       ├── envio.validation.ts    clienteId + mes (opcional YYYY-MM)
│   │       └── cliente.validation.ts  criarClienteSchema + atualizarClienteSchema (Zod)
│   ├── .env                      Configurado com credenciais reais (não versionar)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── App.tsx               Navegação: Envio / Clientes / Configurações
    │   ├── main.tsx              Importa brand.css + components.css
    │   ├── pages/
    │   │   ├── Home.tsx          Envio: pasta local → cruzar clientes → enviar lote consolidado
    │   │   ├── Clientes.tsx      CRUD: tabela paginada + modal + inativar/reativar
    │   │   └── Configuracoes.tsx Template de e-mail editável (assunto e corpo)
    │   ├── services/
    │   │   └── api.ts            axios com x-api-key; todos os endpoints do backend
    │   └── styles/
    │       ├── brand.css         Tokens Seven — NÃO ALTERAR SEM APROVAÇÃO
    │       └── components.css    Header, nav, card, table, badge, modal, icon-btn, paginação
    ├── .env                      VITE_API_URL + VITE_API_KEY configurados
    ├── index.html
    ├── package.json
    └── tsconfig.json
```

---

## Rotas da API (backend)

| Método | Rota                        | Auth      | Descrição                                               |
|--------|-----------------------------|-----------|---------------------------------------------------------|
| GET    | /health                     | Nenhuma   | Health check (excluído do rate limit)                   |
| GET    | /api/status?mes=YYYY-MM     | API Key   | Status geral + histórico filtrado por mês               |
| GET    | /api/clientes               | API Key   | Lista todos os clientes ativos                          |
| GET    | /api/clientes/inativos      | API Key   | Lista clientes inativos                                 |
| GET    | /api/clientes/buscar?q=     | API Key   | Busca clientes por nome                                 |
| GET    | /api/clientes/:id           | API Key   | Busca cliente por ID                                    |
| GET    | /api/clientes/:id/historico | API Key   | Histórico de envios do cliente                          |
| POST   | /api/clientes               | API Key   | Cria novo cliente                                       |
| POST   | /api/clientes/importar      | API Key   | Importa planilha xlsx (multipart)                       |
| PUT    | /api/clientes/:id           | API Key   | Atualiza cliente (inclui e-mails)                       |
| PUT    | /api/clientes/:id/ativar    | API Key   | Reativa cliente inativo                                 |
| DELETE | /api/clientes/:id           | API Key   | Desativa cliente (soft delete)                          |
| GET    | /api/envios/preview?mes=    | API Key   | Escaneia STORAGE_DIR e cruza arquivos × clientes        |
| GET    | /api/envios/enviados?mes=   | API Key   | IDs de clientes com envio bem-sucedido no mês           |
| POST   | /api/envios/cliente         | API Key   | Envia documentos para um cliente (STORAGE_DIR)          |
| POST   | /api/envios/lote            | API Key   | Envia para lista de clientes (STORAGE_DIR + _ok)        |
| POST   | /api/envios/lote-upload     | API Key   | Envio via upload browser (multipart, consolida por e-mail) |
| GET    | /api/config/template        | API Key   | Lê template de e-mail atual                             |
| PUT    | /api/config/template        | API Key   | Salva template de e-mail                                |

---

## Variáveis de ambiente (backend/.env)

| Variável             | Obrigatória  | Descrição                                        |
|----------------------|--------------|--------------------------------------------------|
| API_KEY              | Sim          | Chave de autenticação (header x-api-key)         |
| STORAGE_DIR          | Sim          | Pasta raiz dos documentos mensais                |
| SMTP_HOST            | Sim          | Host SMTP (smtp.gmail.com)                       |
| SMTP_USER            | Sim          | Usuário SMTP                                     |
| SMTP_PASS            | Sim          | Senha de app Google (16 chars sem espaços)       |
| SMTP_FROM            | Não          | Remetente (padrão: SMTP_USER)                    |
| PORT                 | Não (3000)   | Porta do servidor                                |
| SMTP_PORT            | Não (587)    | Porta SMTP                                       |
| SMTP_SECURE          | Não (false)  | TLS direto                                       |
| CORS_ORIGIN          | Não          | Origem permitida (http://localhost:5173)          |
| RATE_LIMIT_WINDOW_MS | Não (900000) | Janela rate limit em ms                          |
| RATE_LIMIT_MAX       | Não (1000)   | Máx requisições por janela ← aumentado de 100    |

---

## Banco de dados (SQLite)

Arquivo: `backend/data/enviardocs.db`

### Tabelas
- **clients** — id, name, cnpj, contact_name, phone, delivery_method, regime, section, folder_name, notes, active, created_at, updated_at
- **client_emails** — id, client_id, email, is_primary
- **send_log** — id, client_id, month, files_count, status (success/error/skipped), error_message, sent_at
- **config** — key, value (armazena template_assunto e template_corpo)

### Dados carregados (2026-05-03)
- **~185 clientes ativos** com e-mail
- 8 clientes sem arquivo em Maio/2026
- 148+ envios registrados em Maio/2026

---

## Comportamento de envio (fluxo principal — browser upload)

1. Usuário clica "Procurar pasta" → browser abre seletor de pasta
2. JS lê os arquivos localmente e cruza com clientes via `normalizarNome()`
3. **`filesWithFullMatch`**: pré-computa arquivos com match exato de nome completo para evitar contaminação cruzada entre unidades da mesma empresa
4. Usuário seleciona clientes → clica "Enviar"
5. Frontend agrupa clientes pelo **conjunto de e-mails** antes do loop de envio
6. Para cada grupo de e-mail: uma única requisição multipart com todos os arquivos combinados
7. Backend (fase 1): valida cada item, monta anexos com fallback Latin-1→UTF-8 nos nomes
8. Backend (fase 2): agrupa por e-mail → envia **um único e-mail** com todos os arquivos do grupo
9. Registra cada cliente no `send_log` individualmente

### Proteção contra reenvio duplicado
- `buscarJaEnviados(mes)` carregado ao escanear a pasta — IDs já enviados ficam azuis e desmarcados
- `foiEnviado(clienteId, mes)` verificado no backend antes de cada envio
- Checkbox "Forçar reenvio" desativa a proteção

### Matching de arquivos
- `normalizarNome()`: remove acentos, chars especiais, maiúsculas, espaços → underscore
- Match exato: `fileNorm.includes(clienteNorm)` (nome completo do cliente)
- Fallback nome base (remove " - UNIDADE"): **só ativado se o arquivo não teve match exato** — evita arquivos de uma unidade aparecerem em outras
- Campo `folder_name` tem prioridade sobre `name`; se vazio/null, usa `name`

### Consolidação de e-mail
- Clientes com o **mesmo conjunto de e-mails** (ex: matriz + filial, Santos & Guedes unidades) recebem **um único e-mail** com todos os arquivos juntos
- A barra de progresso exibe por grupo ("MCZ + PRIME"), não por cliente individual

### Encoding de nomes de arquivo
- Busboy/multer lê nomes de arquivo como Latin-1 (`latin1Slice`)
- `upload.controller.ts` indexa cada arquivo sob dois nomes: `f.originalname` + `Buffer.from(f.originalname, 'latin1').toString('utf8')`
- Cobre nomes com Ç, ´, ã, etc. enviados pelo browser em UTF-8

### Relatório pós-envio
- Botão "⬇ Baixar Relatório" aparece após o envio na seção de resultados
- Gera CSV (BOM UTF-8, separador `;` para Excel) com todos os clientes do scan:
  - Enviado / Erro no envio / Já enviado (sessão anterior) / Sem arquivo / Sem e-mail / Pendente (não selecionado)

---

## Frontend — Páginas

### Envio (Home.tsx)
- Seletor de mês + botão "Procurar pasta"
- 6 cartões clicáveis: Com arquivos / Já enviados / Sem arquivo / Sem e-mail / Selecionados / Total
- Tabela com checkbox por cliente, selecionar todos, busca, toggle "Forçar reenvio"
- Barra de progresso durante envio (por grupo de e-mail)
- Resultado: cards "Enviados" e "Erros" clicáveis (filtram tabela) + botão "⬇ Baixar Relatório"

### Clientes (Clientes.tsx)
- Tabela paginada: **10 / 25 / 50 / Todos** por página
- Busca por nome com debounce 400ms
- Toggle "Mostrar inativos" — exibe lista de clientes inativados
- Modal de edição: todos os campos + gerenciamento de e-mails
- Inativar cliente: botão com confirmação em dois passos dentro do modal
- Reativar cliente: botão na lista de inativos

### Configurações (Configuracoes.tsx)
- Edição de template de e-mail: assunto e corpo com placeholders `{{mes}}` e `{{cliente}}`
- Botão restaurar padrão

---

## Dependências instaladas

### backend
- express, helmet, express-rate-limit, cors
- nodemailer
- better-sqlite3
- xlsx (importação de planilha)
- multer 2.x (upload multipart — busboy 1.x)
- zod
- dotenv
- tsx 4.x (runner TypeScript — sem compilação)
- TypeScript + jest + supertest

### frontend
- react 18 + react-dom
- vite 5 + @vitejs/plugin-react
- axios
- TypeScript

---

## Camadas de segurança ativas

| Camada                | Onde                          | Protege contra                        |
|-----------------------|-------------------------------|---------------------------------------|
| Path traversal guard  | utils/path.util.ts            | `../../` e saídas de diretório        |
| normalizarNome        | utils/nome.util.ts            | Chars especiais em nomes de arquivo   |
| Validação Zod         | validations/                  | Tipos errados, formatos inválidos     |
| Auth timingSafeEqual  | middlewares/apiKey.middleware  | Timing attacks na API key             |
| Helmet                | app.ts                        | Headers HTTP inseguros                |
| Rate limit 1000/15min | app.ts (skip /health)         | Abuso de rota                         |
| Body limit 16kb       | app.ts                        | Body bombing                          |
| Limite 25MB/arquivo   | envio.routes.ts (multer)      | Upload de arquivos gigantes           |
| Limite 500 arquivos   | envio.routes.ts (multer)      | DoS por muitos arquivos               |
| E-mail sempre do DB   | controllers/envio.controller  | Redirecionamento de documentos        |
| Soft delete clientes  | services/cliente.service.ts   | Perda acidental de dados              |
| uncaughtException     | server.ts                     | Quedas do processo por erro inesperado|

---

## Portas em uso

| Serviço  | Porta | Comando dev                       |
|----------|-------|-----------------------------------|
| Backend  | 3000  | `cd backend && npm run dev`       |
| Frontend | 5173  | `cd frontend && npm run dev`      |

---

## Histórico de sessões

### Sessão 1 — 2026-04-07
- Criação do projeto do zero com API segura (OWASP)
- Organização em pastas `backend/` e `frontend/`
- Comandos slash: `/iniciar-dev`, `/fechar-dev`, `/git`, `/atualizar-sessao`
- 23 testes passando

### Sessão 2 — 2026-04-07
- Identidade visual Seven documentada em `.claude/IDENTIDADE_VISUAL.md`
- Tokens CSS em `brand.css` (navy #0D2235 + teal #1B7A8C)
- Layout completo da tela de envio em `App.tsx`

### Sessão 3 — 2026-04-09
- Integração com banco SQLite (better-sqlite3)
- Importação de 181 clientes da planilha `docs/Controle financeiro.xlsx`
- Fusão com projeto original (tsx, cors, normalizarNome, criarCaminhoSeguro)
- Segurança: e-mail sempre vem do banco, nunca do request body
- Reestruturação completa: controllers, services e rotas em português

### Sessão 4 — 2026-04-09/10
- Frontend com 3 páginas: Envio, Clientes, Dashboard
- Navegação por abas no header
- Tela Clientes: tabela paginada, modal de edição, gerenciamento de e-mails
- Tela Dashboard: seletor de mês, cartões de resumo, histórico com destaque de erros
- Tela Envio: seletor de pasta do SO via browser, cruzamento local, envio em lote
- Endpoints novos: /api/status, /api/envios/preview, /api/envios/lote, /api/envios/lote-upload
- Renomeação de arquivos com `_ok` após envio bem-sucedido (fluxo servidor)
- Template de e-mail centralizado em `config/email.template.ts`
- SMTP configurado com App Password do Gmail (sevensistemass@gmail.com)
- multer instalado para upload multipart

### Sessão 5 — 2026-05-02/03
**Operação Maio/2026 — envio real para 185 clientes**

#### Funcionalidades adicionadas
- **Proteção contra reenvio duplo**: `foiEnviado()` no backend + `jaEnviados` Set no frontend; badge azul "Já enviado"; checkbox "Forçar reenvio"
- **Barra de progresso**: atualização em tempo real durante envio (por grupo de e-mail)
- **Resultados persistentes**: painel de resultado fica visível após envio; botão "Fechar resultado"
- **Cards de resultado clicáveis**: "Enviados" e "Erros" filtram a tabela de resultados
- **Inativar/reativar clientes**: botão com confirmação em dois passos no modal; lista de inativos separada
- **Tela Configurações**: template de e-mail editável pelo usuário via UI
- **Importação de planilha**: endpoint `/api/clientes/importar` + UI (multipart xlsx)
- **GET /api/envios/enviados**: IDs de clientes já enviados no mês (carregado ao escanear pasta)
- **Relatório CSV pós-envio**: botão "⬇ Baixar Relatório" — todos os clientes com status (Enviado / Erro / Pendente / Sem arquivo / Sem e-mail)

#### Bugs corrigidos
- **Encoding Latin-1/UTF-8**: busboy lê nomes de arquivo como Latin-1; `upload.controller.ts` indexa com fallback `Buffer.from(name, 'latin1').toString('utf8')` — corrige falha em arquivos com Ç, ´, ã
- **Contaminação cruzada entre unidades**: fallback de "nome base" atribuía arquivos de uma unidade (ex: S&G BOA VISTA) a todas as outras; corrigido com `filesWithFullMatch` — fallback só age em arquivos sem match exato
- **`nomePasta` SANTOS & GUEDES SHOPPING TACARUNA**: atualizado no banco para `"SANTOS & GUEDES COMERCIO LTDA - TACARUNA"` (nome real do arquivo)
- **`registrarEnvio` ausente para `anexos.length === 0`**: erro agora é registrado no `send_log`
- **Rate limit 100→1000**: evitava envios em lote; aumentado para uso interno
- **Quedas do processo**: handlers `uncaughtException`/`unhandledRejection` em `server.ts` impedem que erros de SMTP ou outros derrubem o Node

#### Consolidação de e-mail
- Frontend agrupa `itensSelecionados` por conjunto de e-mails antes do loop
- Uma única requisição multipart por grupo → backend envia um único e-mail com todos os arquivos
- Resolve: MCZ + PRIME (mesmo e-mail), Santos & Guedes unidades, matriz + filial
