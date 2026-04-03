---
name: testar-ncm
description: Testa um ou mais códigos NCM contra a LC 214/2025 — consulta API local, portal SEFAZ/RS e valida com o especialista tributário. Saída em tabela.
---

## Quando usar

Quando o utilizador executar `/testar-ncm` ou pedir para verificar/validar se um NCM está correto para a reforma tributária.

## Pré-condições

- Backend rodando em `http://localhost:3000` (se offline, usar apenas fontes externas e marcar campos como `N/D`)
- NCMs recebidos via argumento do comando ou via pergunta ao utilizador

## Fluxo

### Passo 1 — Consultar API local (por NCM)

`POST http://localhost:3000/api/consultation/analyze`

```json
{
  "ncm": "<código>",
  "regime": "lucroReal",
  "ano": 2026
}
```

Extrair do response:
- `ncm.code` e `ncm.description`
- `classification.cst`, `classification.cClassTrib`, `classification.cClassTribName`
- `taxation.pRedIBS`, `taxation.pRedCBS`
- `taxation.effectiveIbsRate`, `taxation.effectiveCbsRate`
- `legalBasis` (artigo LC 214)

Se erro 401: o backend precisa de login — usar token em cookie ou pedir para o utilizador fazer login primeiro.
Se erro de conexão: marcar todos os campos da API como `N/D` e continuar.

### Passo 2 — Consultar portal SEFAZ/RS

Buscar em: https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributariaNcm

- Pesquisar pelo código NCM
- Extrair: descrição oficial, CST informado, enquadramento fiscal publicado pelo portal
- Se o portal não retornar resultado, registrar como `Não encontrado`

### Passo 3 — Validar com `tax-reform-specialist`

Cruzar os dados dos passos 1 e 2 e verificar:

| Verificação | Critério |
|-------------|----------|
| CST correto? | Conforme LC 214 e a natureza do produto |
| Redução correta? | pRedIBS/pRedCBS compatíveis com o artigo citado |
| Artigo LC 214 válido? | Art. 125 (cesta básica), 128 (agropecuário), 133 (medicamentos/saúde), etc. |
| cClassTrib adequado? | O código é o mais específico disponível para o produto |
| Consistência portal vs sistema? | Se divergir, qual está correto segundo a LC 214? |

### Passo 4 — Tabela resumo (obrigatória)

```markdown
| NCM | Descrição | CST | cClassTrib | pRedIBS | pRedCBS | Artigo LC 214 | Portal SEFAZ/RS | Status | Observações |
|-----|-----------|-----|------------|---------|---------|---------------|-----------------|--------|-------------|
| 30041011 | Medicamentos... | 200 | 200032 | 60% | 60% | Art. 133 | CST 200 ✓ | ✅ OK | Redução correta |
```

**Status:**
- ✅ `OK` — conforme LC 214/2025, sem inconsistências
- ⚠️ `ATENÇÃO` — dado incompleto ou divergência pequena
- ❌ `DIVERGENTE` — CST, redução ou artigo incorreto

### Passo 5 — Detalhamento por NCM

Para cada NCM, após a tabela:

```
### NCM XXXXXXXX — <descrição>

**Enquadramento LC 214/2025**
- CST: XXX (<nome do CST>)
- cClassTrib: XXXXXX — <nome>
- Alíquota IBS efetiva: X,XX% (redução de X%)
- Alíquota CBS efetiva: X,XX% (redução de X%)
- Base legal: <Artigo>, LC 214/2025
- Regime consultado: Lucro Real / 2026

**Validação cruzada**
- Portal SEFAZ/RS: <CST e descrição do portal>
- Sistema local: <CST calculado>
- Divergência: Sim/Não — <detalhe se houver>

**Parecer do especialista**
<Explicação concisa do tax-reform-specialist sobre o enquadramento correto>
```

## Regras

- Nunca inventar alíquotas — usar apenas valores da API e do portal
- Sempre citar artigo da LC 214 quando houver redução ou isenção
- NCM inexistente na tabela NCM vigente: informar e não classificar
- Processar todos os NCMs antes de exibir a tabela final
- Linguagem técnica mas acessível; sem textão introdutório

## Referências

| Recurso | Caminho / URL |
|---------|---------------|
| Agente tributário | `.cursor/agents/tax-reform-specialist.md` |
| Regras LC 214 | `docs/rules/domain/lc214-regras-tributarias.md` |
| Portal SEFAZ/RS | https://dfe-portal.svrs.rs.gov.br/CFF/ClassificacaoTributariaNcm |
| API de análise | `POST http://localhost:3000/api/consultation/analyze` |
| Lookup tributário | `.cursor/skills/tax-reform-lookup/SKILL.md` |
