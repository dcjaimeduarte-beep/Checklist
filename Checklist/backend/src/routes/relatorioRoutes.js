const express = require('express');
const { connectFirebird } = require('../config/firebird');

const router = express.Router();

// MOCK_RELATORIO=1 no .env liga dados fictícios (sem Firebird real) — só para
// validar a UI localmente. Nunca deixar ativo em produção.
const MOCK_ATIVO = process.env.MOCK_RELATORIO === '1';

function mockLinhas(tipo) {
  const base = tipo === 'servico'
    ? [
        { vendedor: 'João Silva',  cliente: 'Auto Center Ltda', item: 'Troca de óleo',        numeroNota: '1001/1' },
        { vendedor: 'Maria Souza', cliente: 'José Pereira',      item: 'Alinhamento e balanceamento', numeroNota: '1002/1' },
        { vendedor: 'João Silva',  cliente: 'Transportes Rio',   item: 'Revisão de freios',    numeroNota: '1003/1' },
      ]
    : [
        { vendedor: 'João Silva',  cliente: 'Auto Center Ltda', item: 'Pastilha de freio',     numeroNota: '1001/1' },
        { vendedor: 'Maria Souza', cliente: 'José Pereira',      item: 'Filtro de óleo',        numeroNota: '1002/1' },
        { vendedor: 'Maria Souza', cliente: 'Transportes Rio',   item: 'Amortecedor dianteiro', numeroNota: '1003/1' },
      ];

  const linhas = base.map((l, i) => ({
    ...l,
    dataEmissao: new Date().toISOString(),
    valorVenda: 100 + i * 50,
    valorTotal: 100 + i * 50,
    comissao: null,
  }));

  const totais = linhas.reduce((acc, l) => ({
    valorVenda: acc.valorVenda + l.valorVenda,
    valorTotal: acc.valorTotal + l.valorTotal,
    comissao: null,
  }), { valorVenda: 0, valorTotal: 0, comissao: null });

  return { ok: true, total: linhas.length, limitado: false, linhas, totais };
}

// ─── GET /api/relatorio/descobrir-comissao ───────────────────────────────────
// Uso interno do dev, não vira tela: localiza campos candidatos a comissão em
// todas as tabelas e expõe as colunas reais de SAIDA_SERVICOS. Rodar isso na
// rede do cliente antes de finalizar as queries de comissao-servicos/pecas.
router.get('/descobrir-comissao', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();

    const sqlCandidatos = `
      SELECT
        rf.RDB$RELATION_NAME AS TABELA,
        rf.RDB$FIELD_NAME AS CAMPO,
        f.RDB$FIELD_TYPE AS TIPO
      FROM RDB$RELATION_FIELDS rf
      JOIN RDB$FIELDS f     ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
      JOIN RDB$RELATIONS r ON r.RDB$RELATION_NAME  = rf.RDB$RELATION_NAME
      WHERE r.RDB$SYSTEM_FLAG = 0
        AND (
          UPPER(rf.RDB$FIELD_NAME) LIKE '%COMISSAO%'
          OR UPPER(rf.RDB$FIELD_NAME) LIKE '%VENDEDOR%'
          OR UPPER(rf.RDB$FIELD_NAME) LIKE '%PERCENTUAL%'
        )
      ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_POSITION
    `;

    db.query(sqlCandidatos, (errC, rowsC) => {
      if (errC) {
        db.detach();
        return res.status(500).json({ ok: false, erro: errC.message });
      }

      const candidatosComissao = (rowsC || []).map(r => ({
        tabela: (r.TABELA || '').trim(),
        campo: (r.CAMPO || '').trim(),
        tipo: r.TIPO,
      }));

      const sqlServicos = `
        SELECT rf.RDB$FIELD_NAME AS CAMPO, f.RDB$FIELD_TYPE AS TIPO
        FROM RDB$RELATION_FIELDS rf
        JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
        WHERE rf.RDB$RELATION_NAME = 'SAIDA_SERVICOS'
        ORDER BY rf.RDB$FIELD_POSITION
      `;

      db.query(sqlServicos, (errS, rowsS) => {
        db.detach();

        if (errS) {
          return res.json({
            ok: true,
            candidatosComissao,
            colunasSaidaServicos: null,
            erroSaidaServicos: errS.message,
          });
        }

        const colunasSaidaServicos = (rowsS || []).map(r => ({
          campo: (r.CAMPO || '').trim(),
          tipo: r.TIPO,
        }));

        res.json({ ok: true, candidatosComissao, colunasSaidaServicos });
      });
    });
  } catch (error) {
    if (db) db.detach();
    res.status(500).json({ ok: false, erro: error.message });
  }
});

// ─── GET /api/relatorio/vendedores ────────────────────────────────────────────
// Popula o dropdown de vendedor nos dois relatórios.
router.get('/vendedores', async (req, res) => {
  if (MOCK_ATIVO) {
    return res.json({
      ok: true,
      vendedores: [
        { id: 1, nome: 'João Silva' },
        { id: 2, nome: 'Maria Souza' },
      ],
    });
  }

  let db;
  try {
    db = await connectFirebird();
    const sql = `SELECT CD_COLABORADOR, NM_COLABORADOR FROM COLABORADOR ORDER BY NM_COLABORADOR`;

    db.query(sql, (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const vendedores = (rows || []).map(r => ({
        id: r.CD_COLABORADOR,
        nome: (r.NM_COLABORADOR || '').trim(),
      }));

      res.json({ ok: true, vendedores });
    });
  } catch (error) {
    if (db) db.detach();
    res.status(500).json({ ok: false, erro: error.message });
  }
});

function validarFiltros(req, res) {
  const { dataInicio, dataFim } = req.query;
  if (!dataInicio || !dataFim) {
    res.status(400).json({ ok: false, erro: 'Informe dataInicio e dataFim.' });
    return null;
  }
  return {
    dataInicio,
    dataFim,
    vendedorId: req.query.vendedorId || null,
    clienteId: req.query.clienteId || null,
  };
}

// ─── GET /api/relatorio/comissao-pecas ───────────────────────────────────────
router.get('/comissao-pecas', async (req, res) => {
  const filtros = validarFiltros(req, res);
  if (!filtros) return;

  if (MOCK_ATIVO) return res.json(mockLinhas('peca'));

  let db;
  try {
    db = await connectFirebird();

    const condicoes = [
      'S.DT_EMISSAO BETWEEN ? AND ?',
      "(S.CK_CANCELADA IS NULL OR S.CK_CANCELADA <> 'T')",
      "S.DS_TIPO_SAIDA = 'V'",
    ];
    const params = [filtros.dataInicio, filtros.dataFim];

    if (filtros.vendedorId) { condicoes.push('S.CD_COLABORADOR = ?'); params.push(filtros.vendedorId); }
    if (filtros.clienteId)  { condicoes.push('S.CD_CLIENTE = ?');     params.push(filtros.clienteId); }

    const sql = `
      SELECT FIRST 2000
        S.CD_SAIDA, S.DS_NUMERO_NOTA, S.DS_SERIE, S.DT_EMISSAO,
        COL.NM_COLABORADOR,
        C.NM_FANTASIA_CLIENTE, C.NM_RAZ_SOC_CLIENTE,
        P.DS_PRODUTO,
        SI.QT_PRODUTO, SI.VL_UNT_PRODUTO, SI.VL_TOTAL_PRODUTO, SI.VL_DESCONTO
        -- PLACEHOLDER_COMISSAO_PECA: campo/percentual de comissão a confirmar
        -- via GET /api/relatorio/descobrir-comissao (candidato provável:
        -- COL.PC_COMISSAO ou COL.VL_COMISSAO por colaborador, ou um campo
        -- por linha em SAIDA_ITENS, se existir)
      FROM SAIDAS S
      INNER JOIN SAIDA_ITENS SI ON SI.CD_SAIDA = S.CD_SAIDA
      LEFT JOIN PRODUTOS P      ON P.CD_PRODUTO = SI.CD_PRODUTO
      LEFT JOIN CLIENTE C       ON C.CD_CLIENTE = S.CD_CLIENTE
      LEFT JOIN COLABORADOR COL ON COL.CD_COLABORADOR = S.CD_COLABORADOR
      WHERE ${condicoes.join(' AND ')}
      ORDER BY S.DT_EMISSAO, S.CD_SAIDA
    `;

    db.query(sql, params, (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const linhas = (rows || []).map(r => ({
        vendedor: (r.NM_COLABORADOR || '').trim(),
        cliente: (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
        item: (r.DS_PRODUTO || '').trim(),
        numeroNota: `${(r.DS_NUMERO_NOTA || '').trim()}${r.DS_SERIE ? '/' + r.DS_SERIE.trim() : ''}`,
        dataEmissao: r.DT_EMISSAO,
        valorVenda: (r.VL_UNT_PRODUTO || 0) / 100,
        valorTotal: (r.VL_TOTAL_PRODUTO || 0) / 100,
        comissao: null, // aguardando confirmação do campo real (ver descobrir-comissao)
      }));

      const totais = linhas.reduce((acc, l) => ({
        valorVenda: acc.valorVenda + l.valorVenda,
        valorTotal: acc.valorTotal + l.valorTotal,
        comissao: null,
      }), { valorVenda: 0, valorTotal: 0, comissao: null });

      res.json({
        ok: true,
        total: linhas.length,
        limitado: linhas.length >= 2000,
        linhas,
        totais,
      });
    });
  } catch (error) {
    if (db) db.detach();
    res.status(500).json({ ok: false, erro: error.message });
  }
});

// ─── GET /api/relatorio/comissao-servicos ────────────────────────────────────
// ATENÇÃO: os nomes de coluna de SAIDA_SERVICOS abaixo são um PALPITE seguindo
// a convenção de SAIDA_ITENS — esta rota não deve ser considerada pronta antes
// de rodar GET /api/relatorio/descobrir-comissao na rede do cliente e ajustar
// os nomes reais.
router.get('/comissao-servicos', async (req, res) => {
  const filtros = validarFiltros(req, res);
  if (!filtros) return;

  if (MOCK_ATIVO) return res.json(mockLinhas('servico'));

  let db;
  try {
    db = await connectFirebird();

    const condicoes = [
      'S.DT_EMISSAO BETWEEN ? AND ?',
      "(S.CK_CANCELADA IS NULL OR S.CK_CANCELADA <> 'T')",
    ];
    const params = [filtros.dataInicio, filtros.dataFim];

    if (filtros.vendedorId) { condicoes.push('S.CD_COLABORADOR = ?'); params.push(filtros.vendedorId); }
    if (filtros.clienteId)  { condicoes.push('S.CD_CLIENTE = ?');     params.push(filtros.clienteId); }

    const sql = `
      SELECT FIRST 2000
        S.CD_SAIDA, S.DS_NUMERO_NOTA, S.DS_SERIE, S.DT_EMISSAO,
        COL.NM_COLABORADOR,
        C.NM_FANTASIA_CLIENTE, C.NM_RAZ_SOC_CLIENTE,
        SS.DS_SERVICO,        -- PLACEHOLDER_SAIDA_SERVICOS_CAMPO: confirmar nome real
        SS.VL_UNT_SERVICO,    -- PLACEHOLDER_SAIDA_SERVICOS_CAMPO: confirmar nome real
        SS.VL_TOTAL_SERVICO   -- PLACEHOLDER_SAIDA_SERVICOS_CAMPO: confirmar nome real
        -- PLACEHOLDER_COMISSAO_SERVICO: campo/percentual de comissão a confirmar
      FROM SAIDAS S
      INNER JOIN SAIDA_SERVICOS SS ON SS.CD_SAIDA = S.CD_SAIDA
      LEFT JOIN CLIENTE C          ON C.CD_CLIENTE = S.CD_CLIENTE
      LEFT JOIN COLABORADOR COL    ON COL.CD_COLABORADOR = S.CD_COLABORADOR
      WHERE ${condicoes.join(' AND ')}
      ORDER BY S.DT_EMISSAO, S.CD_SAIDA
    `;

    db.query(sql, params, (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const linhas = (rows || []).map(r => ({
        vendedor: (r.NM_COLABORADOR || '').trim(),
        cliente: (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
        item: (r.DS_SERVICO || '').trim(),
        numeroNota: `${(r.DS_NUMERO_NOTA || '').trim()}${r.DS_SERIE ? '/' + r.DS_SERIE.trim() : ''}`,
        dataEmissao: r.DT_EMISSAO,
        valorVenda: (r.VL_UNT_SERVICO || 0) / 100,
        valorTotal: (r.VL_TOTAL_SERVICO || 0) / 100,
        comissao: null, // aguardando confirmação do campo real (ver descobrir-comissao)
      }));

      const totais = linhas.reduce((acc, l) => ({
        valorVenda: acc.valorVenda + l.valorVenda,
        valorTotal: acc.valorTotal + l.valorTotal,
        comissao: null,
      }), { valorVenda: 0, valorTotal: 0, comissao: null });

      res.json({
        ok: true,
        total: linhas.length,
        limitado: linhas.length >= 2000,
        linhas,
        totais,
      });
    });
  } catch (error) {
    if (db) db.detach();
    res.status(500).json({ ok: false, erro: error.message });
  }
});

module.exports = router;
