# Security Baseline

## Princípios
- segurança por padrão
- menor privilégio
- validação em todas as entradas
- segredos fora do código
- auditoria de ações críticas
- redução de exposição de dados

## Obrigatório no projeto
- autenticação segura
- autorização por perfil
- proteção de rotas
- logs sem dados sensíveis
- rate limiting
- tratamento padronizado de erros
- criptografia em trânsito
- backups e restore definidos

## Proibições
- credenciais hardcoded
- retorno de stack trace ao usuário
- rotas sem validação
- acesso aberto a dados sensíveis
- alterações grandes sem análise de impacto
