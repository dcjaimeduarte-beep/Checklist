---
name: tax-reform-lookup
description: Consulta reforma tributária e classificação — ordem LC 214 PDF, cClassTrib xlsx, NCM xlsx, Siscomex web + cache SQLite. Palavras-chave: NCM, cClassTrib, LC 214, classificação, Siscomex, scraping, planilha.
---

## Quando usar

Ao responder perguntas sobre **reforma tributária**, **classificação fiscal**, **NCM**, **cClassTrib** ou ao implementar **ingestão / API / UI** que dependam desses dados.

## Política (obrigatória)

1. **Implementação e ordem de dados no produto:** **`.cursor/rules/domain/tax-reform-sources.mdc`** — não resumir de memória se o repositório tiver a fonte.
2. **“Onde procurar” na web e como explicar NCM + reforma (oficiais vs facilitadores):** **`.cursor/rules/domain/ncm-reforma-trusted-sources.mdc`**. Usar ao orientar sobre **sites confiáveis**, **TIPI/NF-e**, ou ao deixar claro que **NCM sozinho não resolve** o enquadramento na LC 214 sem cruzar **cClassTrib** e legislação.

## Fluxo para o assistente

1. **Legislação:** Abrir ou consultar trechos relevantes de **`docs/Lcp 214.pdf`** (Lei Complementar 214) antes de concluir interpretação normativa.
2. **Planilha cClassTrib:** Se o caso exigir códigos/regras de classificação tributária em tabela, usar **`docs/cClassTrib 2026-01-23_Public.xlsx`**.
3. **NCM:** Para nomenclatura/código NCM, usar **`docs/Tabela_NCM_Vigente_20260331.xlsx`**.
4. **Web:** Só se 1–3 não forem suficientes — alinhar com o backend que usa **`URL_SITE`** em `backend/env.sites` (exemplo em `backend/env.sites.example`) e o portal [Siscomex — classificação](https://portalunico.siscomex.gov.br/classif/#/sumario?perfil=publico).

## Implementação (backend / frontend)

- **Cache:** Persistir resultados processados no **SQLite** (TypeORM) para evitar reprocessamento completo.
- **Scraping:** Implementação no **NestJS** (`backend/`), não no frontend — ver **`.cursor/skills/backend/nest-workflow/SKILL.md`** e **`.cursor/agents/backend-specialist.md`**.
- **Login:** Tela dividida (logo Seven + card de login); credenciais via variáveis de ambiente — ver **`backend/.env.example`** e **`AGENTS.md`**.

## Referências

| Ficheiro | Papel |
|----------|--------|
| `.cursor/rules/domain/tax-reform-sources.mdc` | Regra canónica de prioridade e cache (código + `docs/`) |
| `.cursor/rules/domain/ncm-reforma-trusted-sources.mdc` | Fontes oficiais/facilitadores; cruzamento LC 214 + cClassTrib + NCM |
| `AGENTS.md` | Contexto do monorepo e objetivo do site |
| `backend/env.sites.example` | `URL_SITE` para o portal Siscomex |
