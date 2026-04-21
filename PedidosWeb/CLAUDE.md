# PedidosWeb — CLAUDE.md

Sistema web de pedidos de venda integrado ao ERP Solutio (Seven Sistemas) via banco Firebird.

## Stack

**Backend:** NestJS 11 · Firebird (node-firebird) · JWT (cookie HttpOnly) · Helmet  
**Frontend:** React 19 · Vite · TypeScript · Tailwind CSS v4 · lucide-react  
**ERP:** Solutio (Seven Sistemas) · Firebird 2.5+ · banco `.fdb`  
**OS servidor:** Windows Server / Windows 10+ com Solutio Server instalado

## Arquitetura

```
[Browser] → [Vite :5173] → proxy /api → [NestJS :3000] → [Firebird :3050]
```

- Frontend em React — sem SSR, SPA puro, react-router-dom
- Backend lê tabelas nativas do Solutio (SELECT only) + escreve em tabelas PEDIDOS_WEB_*
- Auth via JWT em cookie HttpOnly (`rt_session`)
- Imagens de produtos: disco do servidor ERP → endpoint público `/api/produtos/:id/imagem`

## Módulos backend

| Módulo | Responsabilidade |
|--------|-----------------|
| `auth` | Login/logout/me, JWT, guard, `@Public()` decorator |
| `pedidos` | CRUD de pedidos web, transmissão ao ERP, histórico |
| `produtos` | Busca de produtos no Firebird + serve imagens do disco |
| `clientes` | Busca de clientes no Firebird |
| `condicoes-pagamento` | Lista formas de pagamento do Firebird |
| `empresa` | Dados da empresa do ERP |
| `firebird` | Serviço base de conexão ao Firebird (query/execute/transaction) |

## Tabelas do ERP (somente leitura)

| Tabela | Uso |
|--------|-----|
| `PRODUTOS` | Busca de produtos (nome, código, preço) |
| `ESTOQUE_PRODUTOS` | Saldo real de estoque (QTD_ATUAL, CD_ESTOQUE=1) |
| `CLIENTES` | Busca de clientes |
| `FORMA_PAGAMENTO` | Condições de pagamento |
| `EMPRESA` | Dados da empresa (CNPJ, razão, endereço) |

## Tabelas criadas pelo PedidosWeb (leitura e escrita)

| Tabela | Uso |
|--------|-----|
| `PEDIDOS_WEB` | Pedidos criados via web |
| `PEDIDOS_WEB_ITENS` | Itens dos pedidos |
| `PEDIDOS_WEB_PAGAMENTO` | Condição de pagamento do pedido |
| `PEDIDOS_WEB_HISTORICO` | Log de eventos (status, usuário, data) |

## Variáveis de ambiente (backend/.env)

```env
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173
AUTH_LOGIN_USERNAME=admin
AUTH_LOGIN_PASSWORD=...
JWT_SECRET=...
FB_HOST=127.0.0.1
FB_PORT=3050
FB_DATABASE=D:/Seven/Solutio Server/Dados/AML_AUTO.FDB
FB_USER=SYSDBA
FB_PASSWORD=masterkey
IMAGES_PRODUTOS_DIR=D:/Seven/Solutio Server/Dados/Imagens/AML_AUTO/1/PRODUTOS
```

## Agentes especializados disponíveis

Invocar com `Agent({ subagent_type: 'nome' })` quando necessário:

| Agente | Quando usar |
|--------|------------|
| `erp-commerce-specialist` | Regras de negócio comercial: precificação, condições de pagamento, fluxo de pedido, estoque, CFOP, crédito de cliente, regras fiscais de venda |
| `solutio-erp-specialist` | Estrutura do banco Solutio: qual tabela usar, queries Firebird corretas, comportamentos específicos do Solutio (ex: IN_ATIVO invertido, ESTOQUE_PRODUTOS vs QT_ESTOQUE_ATUAL, generators) |
| `backend-specialist` | Implementação NestJS: endpoints, guards, DTOs, services |
| `frontend-specialist` | Implementação React: componentes, contexts, Tailwind, UX |
| `security-specialist` | Auth, JWT, CORS, validação de inputs, OWASP |
| `code-review` | Revisão de qualidade, performance e segurança do código |

### Quando acionar `erp-commerce-specialist`
- Pergunta sobre regra de negócio: "como calcular desconto máximo?", "quando bloquear cliente?"
- Dúvida sobre CFOP, NF-e, tributação de produtos
- Lógica de vencimento de parcelas, condições de pagamento
- Comportamento esperado em situações comerciais (estoque negativo, preço mínimo)

### Quando acionar `solutio-erp-specialist`
- Qual tabela do Firebird usar para um dado específico
- Query não está retornando o dado correto (ex: estoque zerado, campo null)
- Diagnóstico de estrutura do banco (listar tabelas, colunas)
- Descobrir o nome de uma coluna ou tabela no Solutio
- Integração com novos módulos do ERP (financeiro, NF-e, ordem de compra)

## Regras gerais de desenvolvimento

1. **Nunca** alterar tabelas nativas do Solutio (apenas PEDIDOS_WEB_*)
2. **Sempre** usar parâmetros `?` nas queries Firebird (nunca interpolação direta)
3. **Timeout** obrigatório em todas as queries Firebird (15s query, 20s execute, 30s transaction)
4. Imagens de produto são públicas (`@Public()`) — não requerem JWT
5. Todo endpoint que retorna dados do ERP deve ter fallback para ERP indisponível
6. Estoque real: sempre usar `ESTOQUE_PRODUTOS.QTD_ATUAL` com `LEFT JOIN` (não `PRODUTOS.QT_ESTOQUE_ATUAL`)
7. IN_ATIVO no Solutio é **invertido**: `'S'` = inativo, `'N'` ou NULL = ativo
