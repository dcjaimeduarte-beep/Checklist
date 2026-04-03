# Backend — CLAUDE.md

Instruções específicas para o backend NestJS.

## Stack

NestJS 11 · TypeORM · SQLite (better-sqlite3) · Jest · xlsx · pdf-parse

## Módulos

| Módulo | Responsabilidade |
|--------|-----------------|
| **AuthModule** | JWT em cookie HttpOnly, login/logout, guard `JwtAuthGuard` |
| **ConsultationModule** | `POST /api/consultation/analyze` — consulta individual NCM |
| **BatchModule** | `POST /api/batch/process` — processamento de planilhas XLSX em lote |
| **IngestionModule** | Ingestão automática no boot (LC 214 PDF, cClassTrib XLSX, NCM XLSX) |
| **SiscomexService** | Fallback web scraping do portal Siscomex |

## Arquitetura de consulta

1. Resolver hierarquia NCM (exato → pai → capítulo → seção)
2. Buscar cClassTrib por: texto NCM → keywords da descrição → mapeamento de capítulo
3. Extrair dados estruturados (CST, reduções, alíquotas, indicadores, artigos LC 214)
4. Montar `TaxAnalysisViewDto` com todos os painéis

**Lógica compartilhada** em `src/consultation/tax-analysis.utils.ts` — funções puras usadas tanto pela consulta individual quanto pelo batch.

## Entidades (SQLite)

| Tabela | Descrição |
|--------|-----------|
| `ncm_rows` | Códigos NCM (2–8 dígitos) com descrição e rawRow |
| `cclass_rows` | cClassTrib — rowData JSON com CST, reduções, indicadores |
| `lc214_chunks` | Blocos de texto da LC 214 (4500 chars cada) |
| `search_result_cache` | Cache de consultas (SHA256 key → payload JSON) |
| `web_fetch_cache` | Cache de scraping Siscomex |

## Testes

- Todo arquivo de lógica deve ter `.spec.ts` correspondente.
- Cobertura mínima: **90%** (configurado em `package.json > jest > coverageThreshold`).
- Rodar: `npm test` (unit) ou `npm run test:cov` (com cobertura).
- Mocks: `@nestjs/testing` + `getRepositoryToken()` para repositórios.

## Variáveis de ambiente

Ver `backend/.env.example`. Principais:
- `DATABASE_PATH` — caminho do SQLite (padrão `./data/app.sqlite`)
- `PORT` — porta HTTP (padrão `3000`)
- `FRONTEND_ORIGIN` — CORS (padrão `http://localhost:8080`)
- `AUTH_LOGIN_USERNAME` / `AUTH_LOGIN_PASSWORD` — credenciais demo
- `JWT_SECRET` — segredo para assinar tokens
- `DOCS_PATH` — pasta dos documentos de ingestão (padrão `../docs`)
- `FORCE_REINGEST=1` — forçar re-ingestão no boot

## Convenções

- DTOs em `dto/` com `class-validator`.
- Entidades em `entities/` com decorators TypeORM.
- Nomes de símbolos em inglês, comentários em português.
- Não colocar lógica fiscal no frontend — tudo no backend.
- Usar `tax-analysis.utils.ts` para lógica compartilhada (evitar duplicação entre consulta e batch).
