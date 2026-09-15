# Backend — CLAUDE.md

Instruções específicas para o backend NestJS do sistema AnaliseSped.

## Stack

NestJS 11 · TypeORM · SQLite (better-sqlite3) · Jest · exceljs · pdfkit · nodemailer · fast-xml-parser

## Propósito do sistema

Confronto entre arquivo **SPED Fiscal (EFD ICMS/IPI)** e **XMLs de NF-e/CT-e** de uma pasta. Identifica:
- XMLs presentes na pasta mas **não escriturados no SPED**
- Chaves no SPED **sem XML correspondente** na pasta

## Módulos

| Módulo | Responsabilidade |
|--------|-----------------|
| **AuthModule** | JWT em cookie HttpOnly, login/logout, guard `JwtAuthGuard` |
| **SpedModule** | `SpedService` — parser do arquivo SPED EFD, extrai chaves de C100/D100 e metadata do 0000 |
| **XmlParserModule** | `XmlParserService` — parser de arquivos XML NF-e/CT-e/NFC-e, extrai chave e campos |
| **ConfrontModule** | `ConfrontController` + `ConfrontService` — orquestração do confronto, persistência, download |
| **ReportModule** | `ReportService` — geração de Excel (exceljs), PDF (pdfkit), envio por e-mail (nodemailer) |

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login (retorna cookie JWT) |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/health` | Health check |
| POST | `/api/confront/run` | Upload SPED + XMLs, executa confronto, retorna resultado |
| GET | `/api/confront/sessions` | Lista sessões de confronto (paginado) |
| GET | `/api/confront/:id` | Resultado completo de uma sessão |
| GET | `/api/confront/:id/excel` | Download relatório Excel |
| GET | `/api/confront/:id/pdf` | Download relatório PDF |
| POST | `/api/confront/:id/email` | Envia relatório por e-mail |

## Entidades (SQLite)

| Tabela | Descrição |
|--------|-----------|
| `confront_sessions` | Sessões de confronto: id UUID, cnpj, nome, dtIni, dtFin, contagens |
| `confront_results` | Itens de resultado: tipo (xml_not_in_sped / sped_not_in_xml), chave, campos |

## Parsing SPED EFD

**Registros extraídos:**
- `0000` → CNPJ, nome, período (dtIni/dtFin), UF — split('|')[7], [6], [4], [5], [9]
- `C100` → CHV_NFE — split('|')[9] (44 dígitos)
- `D100` → CHV_CTE — split('|')[10] (44 dígitos)

**Encoding:** detectar BOM UTF-8 ou tratar como latin1 (Windows-1252).

**Filtro de situação (COD_SIT):**
- Incluir: 00, 01, 06, 08
- Sinalizar: 02, 03, 04, 07 (cancelados/denegados)
- Ignorar: 05 (numeração inutilizada)
- Ignorar chaves vazias ou com menos de 44 dígitos

## Parsing XML NF-e/CT-e

**Extrair chave via fast-xml-parser:**
1. Tentar `nfeProc.protNFe.infProt.chNFe` (NFe com protocolo)
2. Tentar `NFe.infNFe.$.Id` ou atributo `Id` de `infNFe` → remover prefixo "NFe"
3. Para CT-e: `cteProc.protCTe.infProt.chCTe` ou atributo de `infCte`

**Campos adicionais do XML:**
- nNF, serie, dhEmi, CNPJ emitente (emit.CNPJ), xNome emitente (emit.xNome), vNF

## Relatório Excel (exceljs)

**3 abas:**
1. **Resumo** — empresa, CNPJ, período, contagens, data geração
2. **XMLs não no SPED** — Chave | Arquivo | Nº NF | Série | Dt Emissão | CNPJ Emit | Razão Social | Valor
3. **SPED sem XML** — Chave | Nº NF | Série | Dt Doc | Modelo | Situação | Operação

**Estilo:** cabeçalhos navy (#1e3a5f), fonte branca, linhas alternadas, colunas auto-width.

## Upload de arquivos

- Usar `multer` com `memoryStorage` (não salvar em disco)
- Limite: 200MB para SPED, 50MB por XML
- Campo `sped` = arquivo único; campo `xmls` = múltiplos arquivos

## Testes

- Todo arquivo de lógica deve ter `.spec.ts` correspondente.
- Cobertura mínima: **80%** (ajustado para novo módulo com I/O intenso).
- Rodar: `npm test` ou `npm run test:cov`.

## Variáveis de ambiente

Ver `backend/.env.example`. Principais:
- `DATABASE_PATH` — caminho do SQLite (padrão `./data/app.sqlite`)
- `PORT` — porta HTTP (padrão `3000`)
- `FRONTEND_ORIGIN` — CORS (padrão `http://localhost:8080`)
- `AUTH_LOGIN_USERNAME` / `AUTH_LOGIN_PASSWORD` — credenciais
- `JWT_SECRET` — segredo JWT
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — config e-mail (opcional)
- `SMTP_FROM` — remetente dos e-mails

## Convenções

- DTOs em `dto/` com `class-validator`.
- Entidades em `entities/` com decorators TypeORM.
- Nomes de símbolos em inglês, comentários em português.
- Nenhuma lógica fiscal no frontend — tudo no backend.
- Funções puras de parsing em arquivos `*.utils.ts` separados.
