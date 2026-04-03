# /testar-ncm

Testar se um ou mais códigos NCM estão de acordo com o padrão da reforma tributária (LC 214/2025).

## O que fazer

1. **Verificar argumentos:** Se o utilizador não forneceu NCMs após o comando, fazer **uma** pergunta:
   > "Qual(is) código(s) NCM você quer testar? (ex.: 30041011 22021000)"

2. **Seguir o workflow completo** em **`.cursor/skills/testar-ncm/SKILL.md`**.

3. Atuar como o subagente **`.cursor/agents/tax-reform-specialist.md`** ao validar o enquadramento.

4. Output **sempre em tabela** com detalhamento por NCM. Formato objetivo, sem textão introdutório.
