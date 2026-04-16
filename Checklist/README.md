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
│   │   ├── app.js                    ← entry point Express (serve API + frontend estático)
│   │   ├── config/firebird.js        ← connectFirebird()
│   │   └── routes/
│   │       ├── bancoRoutes.js        ← /api/banco/*
│   │       └── checklistRoutes.js    ← /api/checklist/*
│   ├── public/                       ← frontend buildado (gerado por npm run build)
│   ├── ecosystem.config.js           ← configuração PM2 (fork mode, porta 3000)
│   └── .env                          ← variáveis de ambiente (não versionado)
├── frontend/
│   ├── public/logo-seven.png         ← logo padrão Seven
│   └── src/
│       ├── App.tsx                   ← renderiza ChecklistPage
│       └── pages/ChecklistPage.tsx   ← página principal completa
├── deploy.bat                        ← instala deps + sobe PM2 (usar como Administrador)
├── start.bat                         ← inicia manualmente sem PM2
├── pm2-startup.bat                   ← configura auto-start com Windows
├── INSTALACAO.md                     ← guia passo a passo para clientes
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

### Iniciar (desenvolvimento)

```bash
# Backend (porta 3000)
cd backend && npm run dev

# Frontend (porta 8080+)
cd frontend && npm run dev
```

O Vite faz proxy de `/api` → `http://localhost:3000` automaticamente.

### Build de produção

```bash
# Gera frontend em backend/public/
cd frontend && npm run build
```

### Deploy no cliente

1. Copiar pasta `Checklist/` para `C:\Seven\Checklist\` no servidor
2. Criar `backend\.env` com o caminho correto do `.fdb`
3. Executar `deploy.bat` como Administrador
4. Executar `pm2-startup.bat` como Administrador (auto-start com Windows)
5. Liberar porta 3000 no Firewall:
   ```
   netsh advfirewall firewall add rule name="Checklist Seven" dir=in action=allow protocol=TCP localport=3000
   ```
6. Acessar: `http://IP_DO_SERVIDOR:3000` em qualquer dispositivo da rede

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

### Mapeamento DS_TIPO_SAIDA

| Código | Descrição |
|---|---|
| `V` | Venda Realizada |
| `O` | Orçamento |
| `S` | Serviço |
| `PV` | Venda em Aberto |

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
| GET | `/api/checklist/veiculo/placa/:placa` | Veículo + lista completa de OS (`osList`) + `ultimaOS` |
| GET | `/api/checklist/veiculo/:id/historico` | Histórico de OS do veículo via SAIDAS |
| GET | `/api/checklist/os/:id` | Detalhes completos de uma OS (cabeçalho + itens) |

---

## Frontend — ChecklistPage

Baseado no modelo `backend/docs/architecture/MODELO_CHECK-LIST.xlsx`.

### Seções do documento

1. **Última OS** *(card informativo)* — exibe tipo (badge colorido), data, colaborador, KM e observação da OS selecionada
2. **Dados do Veículo** — Marca, Modelo, Ano, Placa, KM, Última Manutenção, Descrição, Data de Entrada
3. **Dados do Motorista** — Nome, Fone, CNH, Categoria, Vencimento
4. **Itens Inspecionados** (20 itens em 2 colunas — mantido em impressão)
   - Estados: **BOM** (verde) · **RUIM** (vermelho) · **N.FUNC** (cinza escuro)
5. **Avarias** — diagrama SVG clicável + resumo por peça
   - Marcações: **(A)** Amassado · **(R)** Riscado · **(X)** Quebrado · **(F)** Faltante
6. **Assinaturas** — Responsável, Motorista, Data, Aprovação

### Fluxo de busca por placa

```
Busca placa
    ↓
API retorna: veiculo + osList (todas as OS) + ultimaOS
    ↓
osList.length == 0  → checklist em branco
osList.length == 1  → carrega direto (KM + obs preenchidos)
osList.length >= 2  → abre MODAL com lista para escolher
                       cada item mostra: data · badge tipo · nº · colaborador · KM · obs
                       ao clicar: carrega OS selecionada
```

### Funcionalidades
- Busca por placa → dados do cliente preenchidos automaticamente
- Modal de seleção de OS quando há múltiplos registros (com data, tipo, observação)
- `DS_TIPO_SAIDA` mapeado para label legível com badge colorido
- Observação da OS pré-preenche o campo OBS do checklist automaticamente
- Logo Seven por padrão; botão **"Logo"** na toolbar para trocar pela logo do cliente
- Título da aba = `Checklist {PLACA}` → nome do PDF ao salvar
- Impressão A4 em 2 colunas, cores preservadas, botões ocultos

### Design
- **Navy** `#13293D` — toolbar, cabeçalhos de seção
- **Teal** `#3E7080` — acentos, bordas, botão buscar
- Badges de tipo: verde (Venda) · amarelo (Orçamento) · azul (Serviço) · vermelho (Venda em Aberto)

---

## Testes realizados

| Placa | Resultado |
|---|---|
| SJE6A44 | ONIX PLUS BRANCO — LOCALIZA RENT A CAR — OS #586 (Orçamento) — obs preenchida |

---

## Decisões importantes

- OS vêm da tabela **SAIDAS** (não SAIDA_SERVICOS) — SAIDAS já tem CD_CLIENTE e CD_VEICULO diretos
- `/veiculo/placa/:placa` retorna `osList` (todas as OS, max 100) e `ultimaOS` (a mais recente)
- Valores monetários no Firebird são BIGINT escala /100 (centavos)
- Quantidades de produtos são BIGINT escala /1000
- `git init` foi feito na pasta pai `Documents/GitHub`, apontando para o remote `Checklist.git`
- `.gitignore` na raiz exclui `Sermao/`, `seven-reforma-tributaria-monorepo/`, `node_modules`, `.env`, `*.fdb`
- Express 5 — SPA fallback usa `/{*path}` (não `*` — incompatível com Express 5 + path-to-regexp v8)
- PM2 configurado com `exec_mode: 'fork'` — cluster mode causa SIGINT loop em app CommonJS simples
- `app.listen` vinculado em `0.0.0.0` para aceitar conexões de qualquer dispositivo da rede local
- Frontend buildado em `backend/public/` e servido como estático pelo Express — sem servidor separado em produção
- Pacote de deploy: `checklist-seven-deploy.zip` (~170KB) — contém backend+public, sem node_modules nem fonte do frontend
