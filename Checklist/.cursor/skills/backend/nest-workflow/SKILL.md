---
name: nest-workflow
description: Workflow para novas features NestJS no backend — módulo, controller, service, DTO, entidade TypeORM. Palavras-chave: Nest, módulo, endpoint, API, TypeORM, entity, migration, service, controller, backend.
---

## Visão geral

Esta skill define o **fluxo** para acrescentar capacidades à API em **`backend/`**. A política detalhada está em **`.cursor/rules/backend/backend-standards.mdc`** e em **`backend/docs/architecture/architecture.md`**.

## Antes de codificar

1. Ler **`.cursor/rules/backend/backend-standards.mdc`**.
2. Confirmar se o caso já existe ou se é novo domínio (novo módulo).
3. Alinhar contrato HTTP (método, path, corpo) com o frontend ou documento de API.

## Passos típicos (nova feature)

1. **`src/<feature>/`** — pasta com `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, pasta `dto/` (e `entities/` se houver persistência).
2. **Registar** `FeatureModule` em `app.module.ts` (`imports`).
3. **DTOs** — classes com decorators `class-validator`; nomes claros (`CreateXDto`, `XResponseDto`).
4. **Entidade TypeORM** — só se houver tabela; registada via `TypeOrmModule.forFeature([Entity])` no módulo.
5. **Testes** — unitários no service; e2e em `test/` para rotas críticas quando fizer sentido.

## Persistência

- Desenvolvimento: SQLite em `data/` (ver `getDatabasePath()`).
- Produção futura: PostgreSQL + **migrations**; desativar `synchronize` em prod.

## Referências

| Documento | Papel |
|-----------|--------|
| `.cursor/rules/backend/backend-standards.mdc` | Regras do backend |
| `.cursor/rules/domain/tax-reform-sources.mdc` | Ingestão, SQLite, scraping Siscomex (`env.sites` / `URL_SITE`) |
| `.cursor/skills/tax-reform-lookup/SKILL.md` | Ordem LC 214 → planilhas → web |
| `backend/docs/architecture/architecture.md` | Arquitetura e pastas alvo |
| `AGENTS.md` | Stack e variáveis do monorepo |
