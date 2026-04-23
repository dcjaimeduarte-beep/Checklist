/******************************************************************************/
/*  Checklist Automotivo — Objetos WEB_ para o banco AML_AUTO.FDB             */
/*  Gerado automaticamente pelo sistema.                                       */
/*  Executar no IBExpert ou FlameRobin conectado ao banco Firebird.            */
/*                                                                             */
/*  CONVENÇÕES:                                                                */
/*    Tabelas  : WEB_<NOME>                                                    */
/*    Generators: GEN_WEB_<NOME>                                               */
/*    Índices  : IDX_WEB_<NOME>_<CAMPO>                                        */
/*    Tipos    : domínios do Solutio (TCODIGO, TDESCRICAO200, TLOGICO, etc.)   */
/*    TLOGICO  : CHAR(1), valores 'T' (verdadeiro) / 'F' (falso)              */
/******************************************************************************/

SET SQL DIALECT 3;
SET NAMES WIN1252;


/******************************************************************************/
/*  TABELA: WEB_CHECKLIST_OS_LINK                                              */
/*                                                                             */
/*  Vincula uma sessão de checklist/kanban a uma OS do Solutio (SAIDAS).      */
/*  Criada automaticamente pelo backend Node.js na primeira inicialização.     */
/******************************************************************************/

CREATE TABLE WEB_CHECKLIST_OS_LINK (
  CD_WEB_CHECKLIST_OS_LINK  TCODIGO       NOT NULL,
  CD_EMPRESA                TCODIGO       NOT NULL,
  CD_SAIDA                  TCODIGO       NOT NULL,    /* FK → SAIDAS.CD_SAIDA        */
  CD_VEICULO                TCODIGO,                  /* FK → VEICULOS.CD_VEICULOS   */
  DS_SESSAO_WEB             TDESCRICAO200,             /* ID sessão do checklist (web)*/
  DS_COLABORADOR            TDESCRICAO200,             /* Técnico responsável         */
  DS_OBSERVACAO             TDESCRICAO1500,            /* Observações do checklist    */
  DT_CHECKLIST              DATE,                      /* Data do checklist           */
  HR_CHECKLIST              HORA,                      /* Hora do checklist           */
  CK_CHECKLIST_CONCLUIDO    TLOGICO DEFAULT 'F',       /* T = serviço concluído       */
  CK_NF_EMITIDA             TLOGICO DEFAULT 'F',       /* T = NF transmitida          */
  DS_NUMERO_NF              TDESCRICAO200,             /* Número da NF emitida        */
  DT_NF_EMITIDA             DATE,                      /* Data de emissão da NF       */
  PRIMARY KEY (CD_WEB_CHECKLIST_OS_LINK, CD_EMPRESA)
);

CREATE GENERATOR GEN_WEB_CHECKLIST_OS_LINK;
SET GENERATOR GEN_WEB_CHECKLIST_OS_LINK TO 0;

CREATE OR ALTER TRIGGER WEB_CHECKLIST_OS_LINK_BI
ACTIVE BEFORE INSERT POSITION 0
ON WEB_CHECKLIST_OS_LINK
AS
BEGIN
  IF (NEW.CD_WEB_CHECKLIST_OS_LINK IS NULL) THEN
    NEW.CD_WEB_CHECKLIST_OS_LINK = GEN_ID(GEN_WEB_CHECKLIST_OS_LINK, 1);
END;

CREATE INDEX IDX_WEB_CHECKLIST_SAIDA    ON WEB_CHECKLIST_OS_LINK (CD_SAIDA);
CREATE INDEX IDX_WEB_CHECKLIST_VEICULO  ON WEB_CHECKLIST_OS_LINK (CD_VEICULO);
CREATE INDEX IDX_WEB_CHECKLIST_EMPRESA  ON WEB_CHECKLIST_OS_LINK (CD_EMPRESA);


/******************************************************************************/
/*  TABELA: WEB_KANBAN_CARDS                                                   */
/*                                                                             */
/*  Equivalente Firebird da tabela SQLite kanban_cards.                        */
/*  Pode ser usada para espelhar os dados do kanban no .fdb                   */
/*  ou como fonte de dados caso migre de SQLite para Firebird no futuro.       */
/******************************************************************************/

CREATE TABLE WEB_KANBAN_CARDS (
  CD_WEB_KANBAN_CARD        TDESCRICAO200 NOT NULL,    /* UUID do card (PK)           */
  CD_EMPRESA                TCODIGO       NOT NULL,
  DS_PLACA                  TDESCRICAO10  NOT NULL,    /* Placa do veículo            */
  DS_VEICULO                TDESCRICAO200,             /* Descrição do veículo        */
  DS_COR                    TDESCRICAO200,             /* Cor / descrição do serviço  */
  DS_MOTORISTA              TDESCRICAO200,             /* Nome do cliente/motorista   */
  DS_COLABORADOR            TDESCRICAO200,             /* Técnico responsável         */
  DS_SESSAO                 TDESCRICAO200,             /* ID sessão de vistoria       */
  NR_STATUS                 TCODIGO       NOT NULL DEFAULT 1,
  CK_CONCLUIDO              TLOGICO       DEFAULT 'F', /* T = veículo entregue        */
  DT_CONCLUIDO              DATE,
  HR_CONCLUIDO              HORA,
  DT_CRIADO                 DATE          NOT NULL,
  HR_CRIADO                 HORA          NOT NULL,
  DT_STATUS_ATUALIZADO      DATE          NOT NULL,
  HR_STATUS_ATUALIZADO      HORA          NOT NULL,
  DS_HISTORICO_JSON         TDESCRICAO1500,            /* JSON do histórico de status */
  CD_SAIDA                  TCODIGO,                   /* FK → SAIDAS (se vinculado)  */
  CK_NF_EMITIDA             TLOGICO       DEFAULT 'F',
  DS_NUMERO_NF              TDESCRICAO200,
  PRIMARY KEY (CD_WEB_KANBAN_CARD, CD_EMPRESA)
);

CREATE INDEX IDX_WEB_KANBAN_PLACA    ON WEB_KANBAN_CARDS (DS_PLACA);
CREATE INDEX IDX_WEB_KANBAN_STATUS   ON WEB_KANBAN_CARDS (NR_STATUS);
CREATE INDEX IDX_WEB_KANBAN_CONCLUIDO ON WEB_KANBAN_CARDS (CK_CONCLUIDO);
CREATE INDEX IDX_WEB_KANBAN_SAIDA    ON WEB_KANBAN_CARDS (CD_SAIDA);


/******************************************************************************/
/*  TABELA: WEB_VISTORIAS                                                      */
/*                                                                             */
/*  Equivalente Firebird da tabela SQLite vistorias.                           */
/*  Armazena os metadados das vistorias de entrada/saída de veículos.         */
/******************************************************************************/

CREATE TABLE WEB_VISTORIAS (
  DS_ID_VISTORIA            TDESCRICAO200 NOT NULL,    /* ID da sessão (UUID/datetime) */
  CD_EMPRESA                TCODIGO       NOT NULL,
  DS_PLACA                  TDESCRICAO10  NOT NULL,
  DS_DADOS_JSON             TDESCRICAO1500,            /* JSON do checklist (parcial) */
  DS_FOTOS_JSON             TDESCRICAO1500,            /* JSON com lista de fotos     */
  DS_PDF_NOME               TDESCRICAO200,             /* Nome do arquivo PDF         */
  DT_CRIADO                 DATE          NOT NULL,
  HR_CRIADO                 HORA          NOT NULL,
  PRIMARY KEY (DS_ID_VISTORIA, CD_EMPRESA)
);

CREATE INDEX IDX_WEB_VISTORIAS_PLACA  ON WEB_VISTORIAS (DS_PLACA);
CREATE INDEX IDX_WEB_VISTORIAS_CRIADO ON WEB_VISTORIAS (DT_CRIADO);


/******************************************************************************/
/*  RESUMO DOS OBJETOS CRIADOS                                                 */
/******************************************************************************/
/*
  TABELAS:
    WEB_CHECKLIST_OS_LINK  — Vínculo checklist/kanban ↔ OS Solutio (principal)
    WEB_KANBAN_CARDS       — Espelho do kanban em Firebird (opcional)
    WEB_VISTORIAS          — Espelho das vistorias em Firebird (opcional)

  GENERATORS:
    GEN_WEB_CHECKLIST_OS_LINK

  TRIGGERS:
    WEB_CHECKLIST_OS_LINK_BI  — auto-incremento via generator

  ÍNDICES:
    IDX_WEB_CHECKLIST_SAIDA
    IDX_WEB_CHECKLIST_VEICULO
    IDX_WEB_CHECKLIST_EMPRESA
    IDX_WEB_KANBAN_PLACA
    IDX_WEB_KANBAN_STATUS
    IDX_WEB_KANBAN_CONCLUIDO
    IDX_WEB_KANBAN_SAIDA
    IDX_WEB_VISTORIAS_PLACA
    IDX_WEB_VISTORIAS_CRIADO

  NOTAS:
    - WEB_CHECKLIST_OS_LINK é criada AUTOMATICAMENTE pelo backend na inicialização.
    - WEB_KANBAN_CARDS e WEB_VISTORIAS são opcionais (espelhos para consulta no .fdb).
    - Todos os campos booleanos usam TLOGICO com valores 'T'/'F'.
    - CD_EMPRESA = 1 na maioria dos casos (estrutura suporta multi-empresa).
*/
