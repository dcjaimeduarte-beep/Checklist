/******************************************************************************/
/*  Pedidos Online — Objetos WEB_ para o banco AML_AUTO.FDB                  */
/*  Executar no IBExpert ou FlameRobin conectado ao banco Firebird.           */
/*                                                                             */
/*  CONVENÇÕES:                                                                */
/*    Tabelas   : WEB_<NOME>                                                  */
/*    Generators: GEN_WEB_<NOME>                                              */
/*    Índices   : IDX_WEB_<NOME>_<CAMPO>                                      */
/*    Tipos     : domínios do Solutio (TCODIGO, TDESCRICAO200, TLOGICO, etc.) */
/*    TLOGICO   : CHAR(1), valores 'T' (verdadeiro) / 'F' (falso)            */
/******************************************************************************/

SET SQL DIALECT 3;
SET NAMES WIN1252;


/******************************************************************************/
/*  TABELA: WEB_PEDIDOS                                                        */
/*                                                                             */
/*  Cabeçalho do pedido criado via web.                                       */
/*  DS_STATUS_PEDIDO: RASCUNHO | PENDENTE | TRANSMITINDO | CONFIRMADO |       */
/*                    CANCELADO | ERRO                                         */
/******************************************************************************/

CREATE TABLE WEB_PEDIDOS (
  CD_WEB_PEDIDO         TCODIGO         NOT NULL,          /* PK — auto via trigger        */
  CD_EMPRESA            TCODIGO         NOT NULL DEFAULT 1,/* FK → EMPRESA                 */
  CD_FILIAL             TCODIGO,                           /* FK → FILIAL (opcional)       */
  CD_CLIENTE            TCODIGO,                           /* FK → CLIENTES (opcional)     */
  NM_CLIENTE            TDESCRICAO200   NOT NULL,
  NR_CPF_CNPJ           TDESCRICAO200,
  DS_EMAIL              TDESCRICAO200,
  DS_TELEFONE           TDESCRICAO200,
  DT_PEDIDO             DATE            NOT NULL,
  HR_PEDIDO             HORA,
  DS_STATUS_PEDIDO      TDESCRICAO200   NOT NULL DEFAULT 'RASCUNHO',
  VL_SUBTOTAL           DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_DESCONTO           DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_ACRESCIMO          DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_FRETE              DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_TOTAL              DECIMAL(15,2)   NOT NULL DEFAULT 0,
  CD_CONDICAO_PAG       TCODIGO,                           /* FK → FORMA_PAGAMENTO         */
  DS_CONDICAO_PAG       TDESCRICAO200,
  QT_PARCELAS           TCODIGO,
  DS_OBSERVACAO         TDESCRICAO1500,
  DS_ENDERECO           TDESCRICAO200,
  DS_CIDADE             TDESCRICAO200,
  DS_UF                 TDESCRICAO10,
  DS_CEP                TDESCRICAO10,
  NM_USUARIO_WEB        TDESCRICAO200,
  CK_INTEGRADO_ERP      TLOGICO         DEFAULT 'F',       /* T = integrado ao Solutio     */
  CD_PRE_VENDA          TCODIGO,                           /* FK → PRE_VENDA (pós transmissão) */
  CD_SAIDA              TCODIGO,                           /* FK → SAIDAS (pós faturamento) */
  DT_INTEGRACAO_ERP     DATE,
  DT_ENVIO_ERP          DATE,
  DT_CADASTRO           DATE            NOT NULL,
  HR_CADASTRO           HORA,
  DT_ULT_ALTERACAO      DATE,
  PRIMARY KEY (CD_WEB_PEDIDO, CD_EMPRESA)
);

CREATE GENERATOR GEN_WEB_PEDIDOS;
SET GENERATOR GEN_WEB_PEDIDOS TO 0;

CREATE OR ALTER TRIGGER WEB_PEDIDOS_BI
ACTIVE BEFORE INSERT POSITION 0
ON WEB_PEDIDOS
AS
BEGIN
  IF (NEW.CD_WEB_PEDIDO IS NULL) THEN
    NEW.CD_WEB_PEDIDO = GEN_ID(GEN_WEB_PEDIDOS, 1);
END;

CREATE INDEX IDX_WEB_PEDIDOS_EMPRESA   ON WEB_PEDIDOS (CD_EMPRESA);
CREATE INDEX IDX_WEB_PEDIDOS_CLIENTE   ON WEB_PEDIDOS (CD_CLIENTE);
CREATE INDEX IDX_WEB_PEDIDOS_STATUS    ON WEB_PEDIDOS (DS_STATUS_PEDIDO);
CREATE INDEX IDX_WEB_PEDIDOS_DT_PEDIDO ON WEB_PEDIDOS (DT_PEDIDO);


/******************************************************************************/
/*  TABELA: WEB_PEDIDOS_ITENS                                                  */
/*                                                                             */
/*  Itens (produtos) de cada pedido.                                          */
/*  NR_SEQUENCIAL: ordem do item dentro do pedido (1, 2, 3…)                  */
/******************************************************************************/

CREATE TABLE WEB_PEDIDOS_ITENS (
  CD_WEB_PEDIDO_ITEM    TCODIGO         NOT NULL,          /* PK — auto via trigger        */
  CD_EMPRESA            TCODIGO         NOT NULL DEFAULT 1,
  CD_WEB_PEDIDO         TCODIGO         NOT NULL,          /* FK → WEB_PEDIDOS             */
  NR_SEQUENCIAL         TCODIGO         NOT NULL DEFAULT 1,/* Ordem do item no pedido      */
  CD_PRODUTO            TCODIGO         NOT NULL,          /* FK → PRODUTOS                */
  DS_PRODUTO            TDESCRICAO200   NOT NULL,
  DS_UNIDADE            TDESCRICAO200,
  QT_ITEM               DECIMAL(10,4)   NOT NULL DEFAULT 0,
  VL_UNITARIO           DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_DESCONTO           DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_ACRESCIMO          DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_TOTAL_ITEM         DECIMAL(15,2)   NOT NULL DEFAULT 0,
  DS_OBSERVACAO_ITEM    TDESCRICAO1500,
  PRIMARY KEY (CD_WEB_PEDIDO_ITEM, CD_EMPRESA)
);

CREATE GENERATOR GEN_WEB_PEDIDOS_ITEM;
SET GENERATOR GEN_WEB_PEDIDOS_ITEM TO 0;

CREATE OR ALTER TRIGGER WEB_PEDIDOS_ITENS_BI
ACTIVE BEFORE INSERT POSITION 0
ON WEB_PEDIDOS_ITENS
AS
BEGIN
  IF (NEW.CD_WEB_PEDIDO_ITEM IS NULL) THEN
    NEW.CD_WEB_PEDIDO_ITEM = GEN_ID(GEN_WEB_PEDIDOS_ITEM, 1);
END;

CREATE INDEX IDX_WEB_PEDIDOS_ITENS_PEDIDO  ON WEB_PEDIDOS_ITENS (CD_WEB_PEDIDO);
CREATE INDEX IDX_WEB_PEDIDOS_ITENS_PRODUTO ON WEB_PEDIDOS_ITENS (CD_PRODUTO);


/******************************************************************************/
/*  TABELA: WEB_PEDIDOS_PAGAMENTO                                              */
/*                                                                             */
/*  Condição de pagamento escolhida pelo cliente no pedido.                   */
/*  Um pedido tem no máximo um registro de pagamento.                         */
/******************************************************************************/

CREATE TABLE WEB_PEDIDOS_PAGAMENTO (
  CD_WEB_PEDIDO_PAG     TCODIGO         NOT NULL,          /* PK — auto via trigger        */
  CD_EMPRESA            TCODIGO         NOT NULL DEFAULT 1,
  CD_WEB_PEDIDO         TCODIGO         NOT NULL,          /* FK → WEB_PEDIDOS             */
  CD_CONDICAO_PAG       TCODIGO,                           /* FK → FORMA_PAGAMENTO         */
  DS_CONDICAO_PAG       TDESCRICAO200,
  QT_PARCELAS           TCODIGO,
  VL_ENTRADA            DECIMAL(15,2)   NOT NULL DEFAULT 0,
  VL_PARCELAS           DECIMAL(15,2)   NOT NULL DEFAULT 0,
  DT_1_VENCIMENTO       DATE,
  DS_OBSERVACAO         TDESCRICAO1500,
  CK_CONFIRMADO         TLOGICO         DEFAULT 'F',       /* T = pagamento confirmado     */
  DT_CADASTRO           DATE            NOT NULL,
  PRIMARY KEY (CD_WEB_PEDIDO_PAG, CD_EMPRESA)
);

CREATE GENERATOR GEN_WEB_PEDIDOS_PAG;
SET GENERATOR GEN_WEB_PEDIDOS_PAG TO 0;

CREATE OR ALTER TRIGGER WEB_PEDIDOS_PAGAMENTO_BI
ACTIVE BEFORE INSERT POSITION 0
ON WEB_PEDIDOS_PAGAMENTO
AS
BEGIN
  IF (NEW.CD_WEB_PEDIDO_PAG IS NULL) THEN
    NEW.CD_WEB_PEDIDO_PAG = GEN_ID(GEN_WEB_PEDIDOS_PAG, 1);
END;

CREATE INDEX IDX_WEB_PEDIDOS_PAG_PEDIDO ON WEB_PEDIDOS_PAGAMENTO (CD_WEB_PEDIDO);


/******************************************************************************/
/*  TABELA: WEB_PEDIDOS_HISTORICO                                              */
/*                                                                             */
/*  Log de eventos do pedido: mudanças de status, transmissões, erros.        */
/******************************************************************************/

CREATE TABLE WEB_PEDIDOS_HISTORICO (
  CD_WEB_PEDIDO_HIST    TCODIGO         NOT NULL,          /* PK — auto via trigger        */
  CD_EMPRESA            TCODIGO         NOT NULL DEFAULT 1,
  CD_WEB_PEDIDO         TCODIGO         NOT NULL,          /* FK → WEB_PEDIDOS             */
  DT_EVENTO             DATE            NOT NULL,
  HR_EVENTO             HORA,
  DS_STATUS_ANTERIOR    TDESCRICAO200,
  DS_STATUS_NOVO        TDESCRICAO200,
  DS_TIPO_EVENTO        TDESCRICAO200,
  DS_EVENTO             TDESCRICAO1500,
  NM_USUARIO_WEB        TDESCRICAO200,
  PRIMARY KEY (CD_WEB_PEDIDO_HIST, CD_EMPRESA)
);

CREATE GENERATOR GEN_WEB_PEDIDOS_HIST;
SET GENERATOR GEN_WEB_PEDIDOS_HIST TO 0;

CREATE OR ALTER TRIGGER WEB_PEDIDOS_HISTORICO_BI
ACTIVE BEFORE INSERT POSITION 0
ON WEB_PEDIDOS_HISTORICO
AS
BEGIN
  IF (NEW.CD_WEB_PEDIDO_HIST IS NULL) THEN
    NEW.CD_WEB_PEDIDO_HIST = GEN_ID(GEN_WEB_PEDIDOS_HIST, 1);
END;

CREATE INDEX IDX_WEB_PEDIDOS_HIST_PEDIDO ON WEB_PEDIDOS_HISTORICO (CD_WEB_PEDIDO);
CREATE INDEX IDX_WEB_PEDIDOS_HIST_DT     ON WEB_PEDIDOS_HISTORICO (DT_EVENTO);


/******************************************************************************/
/*  RESUMO DOS OBJETOS CRIADOS                                                 */
/******************************************************************************/
/*
  TABELAS:
    WEB_PEDIDOS            — Cabeçalho do pedido
    WEB_PEDIDOS_ITENS      — Produtos do pedido
    WEB_PEDIDOS_PAGAMENTO  — Condição de pagamento do pedido
    WEB_PEDIDOS_HISTORICO  — Log de eventos

  GENERATORS:
    GEN_WEB_PEDIDOS
    GEN_WEB_PEDIDOS_ITEM
    GEN_WEB_PEDIDOS_PAG
    GEN_WEB_PEDIDOS_HIST

  TRIGGERS (BEFORE INSERT — auto-incremento):
    WEB_PEDIDOS_BI
    WEB_PEDIDOS_ITENS_BI
    WEB_PEDIDOS_PAGAMENTO_BI
    WEB_PEDIDOS_HISTORICO_BI

  ÍNDICES:
    IDX_WEB_PEDIDOS_EMPRESA, IDX_WEB_PEDIDOS_CLIENTE,
    IDX_WEB_PEDIDOS_STATUS, IDX_WEB_PEDIDOS_DT_PEDIDO
    IDX_WEB_PEDIDOS_ITENS_PEDIDO, IDX_WEB_PEDIDOS_ITENS_PRODUTO
    IDX_WEB_PEDIDOS_PAG_PEDIDO
    IDX_WEB_PEDIDOS_HIST_PEDIDO, IDX_WEB_PEDIDOS_HIST_DT

  NOTAS:
    - TLOGICO usa 'T' (verdadeiro) / 'F' (falso) — padrão Solutio
    - CD_EMPRESA presente em todas as tabelas (suporte multi-empresa)
    - Triggers garantem auto-incremento via GEN_ID mesmo sem passar o PK
*/
