const express = require('express');
const { connectFirebird } = require('../config/firebird');

const router = express.Router();

router.get('/teste-conexao', async (req, res) => {
  let db;

  try {
    db = await connectFirebird();
    db.detach();

    return res.json({
      ok: true,
      mensagem: 'Conexão com Firebird realizada com sucesso.'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      erro: error.message
    });
  }
});

router.get('/tabelas', async (req, res) => {
  let db;

  try {
    db = await connectFirebird();

    const sql = `
      SELECT RDB$RELATION_NAME
      FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0
        AND COALESCE(RDB$VIEW_BLR, '') = ''
      ORDER BY RDB$RELATION_NAME
    `;

    db.query(sql, (err, result) => {
      db.detach();

      if (err) {
        return res.status(500).json({
          ok: false,
          erro: err.message
        });
      }

      const tabelas = result.map(item => item['RDB$RELATION_NAME'].trim());

      return res.json({
        ok: true,
        total: tabelas.length,
        tabelas
      });
    });
  } catch (error) {
    if (db) db.detach();

    return res.status(500).json({
      ok: false,
      erro: error.message
    });
  }
});

router.get('/campos/:tabela', async (req, res) => {
  let db;

  try {
    db = await connectFirebird();

    const tabela = req.params.tabela.toUpperCase();

    const sql = `
      SELECT
        rf.RDB$FIELD_NAME AS CAMPO,
        f.RDB$FIELD_TYPE AS TIPO,
        f.RDB$FIELD_LENGTH AS TAMANHO
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f
        ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      WHERE rf.RDB$RELATION_NAME = ?
      ORDER BY rf.RDB$FIELD_POSITION
    `;

    db.query(sql, [tabela], (err, result) => {
      db.detach();

      if (err) {
        return res.status(500).json({
          ok: false,
          erro: err.message
        });
      }

      const campos = result.map(item => ({
        campo: item.CAMPO ? item.CAMPO.trim() : null,
        tipo: item.TIPO,
        tamanho: item.TAMANHO
      }));

      return res.json({
        ok: true,
        tabela,
        total: campos.length,
        campos
      });
    });
  } catch (error) {
    if (db) db.detach();

    return res.status(500).json({
      ok: false,
      erro: error.message
    });
  }
});

module.exports = router;
