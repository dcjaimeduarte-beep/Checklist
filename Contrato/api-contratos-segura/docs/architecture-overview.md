# Architecture Overview

## Objetivo
Estruturar um sistema seguro e modular para formulação de contratos empresariais.

## Estrutura principal
- `apps/api`: backend da aplicação
- `apps/web`: frontend administrativo
- `docs`: documentação viva
- `.cursor/rules`: regras persistentes de projeto
- `.cursor/skills`: padrões reutilizáveis para tarefas recorrentes

## Diretrizes
- separação clara de responsabilidades
- validação obrigatória de entrada
- autenticação e autorização centralizadas
- auditoria de ações críticas
- documentação contínua

## Módulos previstos
- auth
- users
- companies
- clients
- contract-templates
- contract-drafts
- audit-log

## Expansão futura
- assinatura eletrônica
- portal do cliente
- fluxo de aprovação
- notificações
