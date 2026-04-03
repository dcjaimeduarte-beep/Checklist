require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Firebird = require('node-firebird');

const options = {
  host: process.env.FB_HOST,
  port: parseInt(process.env.FB_PORT),
  database: process.env.FB_DATABASE,
  user: process.env.FB_USER,
  password: process.env.FB_PASSWORD,
  lowercase_keys: false,
  role: null,
  pageSize: 4096,
};

const typeMap = {
  7: 'SMALLINT', 8: 'INTEGER', 9: 'QUAD', 10: 'FLOAT',
  12: 'DATE', 13: 'TIME', 14: 'CHAR', 16: 'BIGINT',
  27: 'DOUBLE', 35: 'TIMESTAMP', 37: 'VARCHAR', 40: 'CSTRING',
  45: 'BLOB_ID', 261: 'BLOB'
};

Firebird.attach(options, (err, db) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    process.exit(1);
  }
  console.log('Conectado!\n');

  // Uma única query que traz tabela + campos juntos
  const sql = `
    SELECT
      RF.RDB$RELATION_NAME AS TABELA,
      RF.RDB$FIELD_NAME AS CAMPO,
      F.RDB$FIELD_TYPE AS TIPO,
      F.RDB$FIELD_LENGTH AS TAMANHO,
      RF.RDB$FIELD_POSITION AS POSICAO
    FROM RDB$RELATION_FIELDS RF
    JOIN RDB$FIELDS F ON RF.RDB$FIELD_SOURCE = F.RDB$FIELD_NAME
    JOIN RDB$RELATIONS R ON R.RDB$RELATION_NAME = RF.RDB$RELATION_NAME
    WHERE R.RDB$SYSTEM_FLAG = 0
      AND R.RDB$VIEW_BLR IS NULL
    ORDER BY RF.RDB$RELATION_NAME, RF.RDB$FIELD_POSITION
  `;

  db.query(sql, [], (err, rows) => {
    db.detach();

    if (err) {
      console.error('Erro na query:', err.message);
      return;
    }

    const tables = {};
    rows.forEach(row => {
      const tbl = row['TABELA'].trim();
      if (!tables[tbl]) tables[tbl] = [];
      const type = typeMap[row['TIPO']] || `TYPE_${row['TIPO']}`;
      const len = row['TAMANHO'] ? `(${row['TAMANHO']})` : '';
      tables[tbl].push(`  - ${row['CAMPO'].trim()}: ${type}${len}`);
    });

    const tableNames = Object.keys(tables).sort();
    console.log(`=== ${tableNames.length} TABELAS ===\n`);
    tableNames.forEach(tbl => {
      console.log(`[${tbl}]`);
      tables[tbl].forEach(l => console.log(l));
      console.log('');
    });
    console.log('=== FIM ===');
  });
});
