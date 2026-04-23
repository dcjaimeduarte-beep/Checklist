# Backend — CLAUDE.md (Checklist Automotivo)

Instruções específicas para o backend do sistema de checklist de vistoria veicular.

## Stack

Node.js · Express · node-firebird · multer · sharp · uuid · dotenv · nodemon

## Entry point

`src/app.js` — registra todas as rotas, serve frontend buildado de `public/`, serve uploads estático.

## Rotas

| Arquivo | Prefixo | Descrição |
|---------|---------|-----------|
| `routes/bancoRoutes.js` | `/api/banco` | Diagnóstico da conexão Firebird, listagem de tabelas |
| `routes/checklistRoutes.js` | `/api/checklist` | Busca de clientes, veículos e OS no Firebird |
| `routes/vistoriaRoutes.js` | `/api/vistoria` | Salvar/listar/carregar vistorias e fotos (filesystem) |
| `routes/kanbanRoutes.js` | `/api/kanban` | Kanban SSE + CRUD de cards (JSON filesystem) |

## checklistRoutes — endpoints Firebird

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/checklist/cliente/buscar?q=` | Busca por nome/CPF/telefone |
| `GET /api/checklist/cliente/:id/veiculos` | Veículos do cliente |
| `GET /api/checklist/cliente/:id/historico` | OS do cliente via SAIDAS |
| `GET /api/checklist/veiculo/placa/:placa` | Veículo pela placa |
| `GET /api/checklist/veiculo/:id/historico` | OS do veículo |
| `GET /api/checklist/os/:id` | Detalhes de uma OS |

## vistoriaRoutes — endpoints filesystem

| Endpoint | Descrição |
|----------|-----------|
| `POST /api/vistoria/salvar` | Salva JSON + fotos. Compressão: JPEG q75, max 1600px (sharp) |
| `GET /api/vistoria/historico/:placa` | Lista sessões salvas |
| `GET /api/vistoria/:placa/:sessao` | Carrega checklist.json + URLs das fotos |
| `GET /uploads/{placa}/{sessao}/{arquivo}` | Serve fotos via static |

## kanbanRoutes — endpoints + SSE

| Endpoint | Descrição |
|----------|-----------|
| `GET /api/kanban/eventos` | SSE — broadcast de `init`, `card_added`, `card_updated`, `card_removed` |
| `GET /api/kanban/cards` | Lista todos os cards |
| `POST /api/kanban/card` | Cria card (`placa`, `veiculo`, `cor`, `motorista`, `sessao`) |
| `PATCH /api/kanban/card/:id/status` | Atualiza status (`status`, `label` opcional) — atualiza histórico |
| `DELETE /api/kanban/card/:id` | Remove card |

Persistência: `data/kanban.json` (criado automaticamente). **Não commitar este arquivo.**

SSE mantém heartbeat `: ping\n\n` a cada 25s para evitar timeout de proxy.

## Banco de dados Firebird

- Arquivo: `D:\Seven\Solutio Server\Dados\AML_AUTO.FDB`
- Configuração via `.env`: `FB_HOST`, `FB_PORT`, `FB_DATABASE`, `FB_USER`, `FB_PASSWORD`
- Tabelas-chave: `CLIENTE`, `VEICULOS`, `MARCA_VEICULO`, `MODELO_VEICULO`, `SAIDAS`, `SAIDA_ITENS`, `COLABORADOR`

## Variáveis de ambiente (`.env`)

```
PORT=3000
UPLOADS_PATH=               # caminho absoluto para pasta de fotos (padrão: backend/uploads/)
FB_HOST=localhost
FB_PORT=3050
FB_DATABASE=D:\Seven\Solutio Server\Dados\AML_AUTO.FDB
FB_USER=SYSDBA
FB_PASSWORD=masterkey
```

## Portas

| Ambiente | Porta |
|----------|-------|
| Produção (PM2) | **3000** |
| Dev v2 local | **3001** (definir `PORT=3001` no `.env`) |

## Estrutura de uploads

```
uploads/
└── {PLACA}/
    └── {YYYY-MM-DD_HHmmss_uuid}/
        ├── checklist.json
        ├── foto_01.jpg
        └── foto_02.jpg
```

## Convenções

- Sem TypeScript — JavaScript puro com CommonJS (`require`/`module.exports`).
- Toda lógica de negócio fica no backend; frontend só exibe.
- Não commitar `data/`, `uploads/` — dados de runtime.
- `.env` nunca commitado.
