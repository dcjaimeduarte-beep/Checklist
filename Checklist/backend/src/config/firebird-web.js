const { connectFirebird } = require('./firebird');

function queryFB(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (err, result) => {
      if (err) reject(err);
      else resolve(result || []);
    });
  });
}

async function initFirebirdWebTables() {
  let db;
  try {
    db = await connectFirebird();

    const rows = await queryFB(db,
      "SELECT 1 FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = 'WEB_CHECKLIST_OS_LINK' AND RDB$SYSTEM_FLAG = 0"
    );

    if (rows.length > 0) {
      db.detach();
      return; // tabela já existe
    }

    console.log('[Firebird] Criando tabelas WEB_...');

    await queryFB(db, `
      CREATE TABLE WEB_CHECKLIST_OS_LINK (
        CD_WEB_CHECKLIST_OS_LINK  TCODIGO    NOT NULL,
        CD_EMPRESA                TCODIGO    NOT NULL,
        CD_SAIDA                  TCODIGO    NOT NULL,
        CD_VEICULO                TCODIGO,
        DS_SESSAO_WEB             TDESCRICAO200,
        DS_COLABORADOR            TDESCRICAO200,
        DS_OBSERVACAO             TDESCRICAO1500,
        DT_CHECKLIST              DATE,
        HR_CHECKLIST              HORA,
        CK_CHECKLIST_CONCLUIDO    TLOGICO DEFAULT 'F',
        CK_NF_EMITIDA             TLOGICO DEFAULT 'F',
        DS_NUMERO_NF              TDESCRICAO200,
        DT_NF_EMITIDA             DATE,
        PRIMARY KEY (CD_WEB_CHECKLIST_OS_LINK, CD_EMPRESA)
      )
    `);

    await queryFB(db, 'CREATE GENERATOR GEN_WEB_CHECKLIST_OS_LINK');
    await queryFB(db, 'SET GENERATOR GEN_WEB_CHECKLIST_OS_LINK TO 0');

    await queryFB(db, `
      CREATE TRIGGER WEB_CHECKLIST_OS_LINK_BI
      ACTIVE BEFORE INSERT POSITION 0
      ON WEB_CHECKLIST_OS_LINK
      AS
      BEGIN
        IF (NEW.CD_WEB_CHECKLIST_OS_LINK IS NULL) THEN
          NEW.CD_WEB_CHECKLIST_OS_LINK = GEN_ID(GEN_WEB_CHECKLIST_OS_LINK, 1);
      END
    `);

    await queryFB(db, 'CREATE INDEX IDX_WEB_CHECKLIST_SAIDA    ON WEB_CHECKLIST_OS_LINK (CD_SAIDA)');
    await queryFB(db, 'CREATE INDEX IDX_WEB_CHECKLIST_VEICULO  ON WEB_CHECKLIST_OS_LINK (CD_VEICULO)');

    db.detach();
    console.log('[Firebird] Tabelas WEB_ criadas com sucesso.');
  } catch (err) {
    if (db) try { db.detach(); } catch {}
    console.error('[Firebird] Erro ao criar tabelas WEB_:', err.message);
  }
}

module.exports = { initFirebirdWebTables, queryFB };
