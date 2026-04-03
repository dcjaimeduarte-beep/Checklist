# Checklist Automotivo

Sistema de checklist de entrada/saída de veículos conectado ao banco Firebird da empresa (AML_AUTO.FDB).

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express + node-firebird + dotenv + nodemon |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide React |
| Banco | Firebird — `D:\Seven\Solutio Server\Dados\AML_AUTO.FDB` |

---

## Estrutura de pastas

```
Checklist/
├── backend/
│   ├── src/
│   │   ├── app.js                    ← entry point Express
│   │   ├── config/firebird.js        ← connectFirebird()
│   │   └── routes/
│   │       ├── bancoRoutes.js        ← /api/banco/*
│   │       └── checklistRoutes.js    ← /api/checklist/*
│   ├── scripts/explore-db.js         ← exploração do banco Firebird
│   └── .env                          ← variáveis de ambiente (não versionado)
├── frontend/
│   ├── public/logo-seven.png         ← logo padrão Seven
│   └── src/
│       ├── App.tsx                   ← renderiza ChecklistPage
│       └── pages/ChecklistPage.tsx   ← página principal completa
└── README.md
```

---

## Configuração

### Backend — `.env`

```env
PORT=3000

FB_HOST=127.0.0.1
FB_PORT=3050
FB_DATABASE=D:\Seven\Solutio Server\Dados\AML_AUTO.FDB
FB_USER=SYSDBA
FB_PASSWORD=masterkey
```

### Iniciar

```bash
# Backend (porta 3000)
cd backend && npm run dev

# Frontend (porta 8080+)
cd frontend && npm run dev
```

O Vite faz proxy de `/api` → `http://localhost:3000` automaticamente.

---

## Banco de dados Firebird

299 tabelas mapeadas. Tabelas principais do checklist:

| Tabela | Campos chave |
|---|---|
| `CLIENTE` | CD_CLIENTE, NM_FANTASIA_CLIENTE, NM_RAZ_SOC_CLIENTE, CD_CGC_CLIENTE, CD_FONE_CLIENTE, CD_CELULAR_CLIENTE |
| `VEICULOS` | CD_VEICULOS, DS_PLACA, CD_MARCA_VEICULO, CD_MODELO_VEICULO, DS_DESCRICAO, CD_CLIENTE, VL_KM_VEICULO, DT_ULTIMA_ENTRADA |
| `MARCA_VEICULO` | CD_MARCA_VEICULO, DS_MARCA_VEICULO |
| `MODELO_VEICULO` | CD_MODELO_VEICULO, DS_MODELO_VEICULO |
| `SAIDAS` | Fonte principal de OS — tem CD_CLIENTE e CD_VEICULO direto. **Não usar SAIDA_SERVICOS.** |
| `SAIDA_ITENS` | Peças/produtos de uma OS |
| `COLABORADOR` | CD_COLABORADOR, NM_COLABORADOR |

---

## Endpoints

### `/api/banco`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/banco/teste-conexao` | Testa conexão com Firebird |
| GET | `/api/banco/tabelas` | Lista todas as tabelas |
| GET | `/api/banco/campos/:tabela` | Campos de uma tabela |

### `/api/checklist`
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/checklist/cliente/buscar?q=` | Busca cliente por nome/CPF/telefone |
| GET | `/api/checklist/cliente/:id/veiculos` | Veículos do cliente (com marca e modelo) |
| GET | `/api/checklist/cliente/:id/historico` | Histórico de OS do cliente via SAIDAS |
| GET | `/api/checklist/veiculo/placa/:placa` | Veículo pela placa com dados do cliente |
| GET | `/api/checklist/veiculo/:id/historico` | Histórico de OS do veículo via SAIDAS |
| GET | `/api/checklist/os/:id` | Detalhes completos de uma OS (cabeçalho + itens) |

---

## Frontend — ChecklistPage

Baseado no modelo `backend/docs/architecture/MODELO_CHECK-LIST.xlsx`.

### Seções

1. **Dados do Veículo** — Marca, Modelo, Ano, Placa, KM, Última Manutenção, Descrição, Data de Entrada
2. **Dados do Motorista** — Nome, Fone, CNH, Categoria, Vencimento
3. **Itens Inspecionados** (20 itens em 2 colunas)
   - Estados: **BOM** (verde) · **RUIM** (vermelho) · **N.FUNC** (cinza escuro)
4. **Avarias** — diagrama SVG clicável do veículo
   - Marcações: **(A)** Amassado · **(R)** Riscado · **(X)** Quebrado · **(F)** Faltante
   - Seleciona tipo → clica na peça do diagrama
5. **Assinaturas** — Responsável, Motorista, Data, Aprovação

### Funcionalidades
- Busca veículo pela placa e preenche automaticamente os dados do cliente
- Logo Seven por padrão; botão **"Logo"** na toolbar para carregar logo do cliente
- Título da aba muda para `Checklist {PLACA}` → PDF salvo com esse nome
- Impressão A4 com itens em 2 colunas, cores preservadas, botões ocultos

### Design
- **Navy** `#13293D` — toolbar, cabeçalhos de seção
- **Teal** `#3E7080` — acentos, botão buscar

---

## Testes realizados

| Placa | Resultado |
|---|---|
| SJE6A44 | ONIX PLUS BRANCO — LOCALIZA RENT A CAR — 1 OS (#586) |

---

## Decisões importantes

- OS vêm da tabela **SAIDAS** (não SAIDA_SERVICOS) — SAIDAS já tem CD_CLIENTE e CD_VEICULO diretos
- Valores monetários no Firebird são BIGINT com escala /100 (centavos)
- Quantidades de produtos são BIGINT com escala /1000
- O `git init` foi feito na pasta pai `Documents/GitHub`, apontando para o remote `Checklist.git`
- `.gitignore` na raiz exclui `Sermao/`, `seven-reforma-tributaria-monorepo/`, `node_modules`, `.env`, `*.fdb`
