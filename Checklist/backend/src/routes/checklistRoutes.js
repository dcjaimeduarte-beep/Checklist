const express = require('express');
const { connectFirebird } = require('../config/firebird');

const router = express.Router();

const TIPO_SAIDA_LABEL = {
  'V':  'Venda Realizada',
  'O':  'Orçamento',
  'S':  'Serviço',
  'PV': 'Venda em Aberto',
};

function labelTipo(tipo) {
  if (!tipo) return '';
  const t = tipo.trim().toUpperCase();
  return TIPO_SAIDA_LABEL[t] || tipo.trim();
}

// Buscar cliente por nome, CPF/CNPJ ou telefone
router.get('/cliente/buscar', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ ok: false, erro: 'Informe ao menos 2 caracteres para busca.' });
  }

  let db;
  try {
    db = await connectFirebird();
    const termo = `%${q.toUpperCase()}%`;

    const sql = `
      SELECT FIRST 20
        CD_CLIENTE,
        NM_FANTASIA_CLIENTE,
        NM_RAZ_SOC_CLIENTE,
        CD_CGC_CLIENTE,
        CD_FONE_CLIENTE,
        CD_CELULAR_CLIENTE,
        DS_EMAIL_CLIENTE,
        INATIVO
      FROM CLIENTE
      WHERE INATIVO <> 'S'
        AND (
          UPPER(NM_FANTASIA_CLIENTE) LIKE ?
          OR UPPER(NM_RAZ_SOC_CLIENTE) LIKE ?
          OR CD_CGC_CLIENTE LIKE ?
          OR CD_FONE_CLIENTE LIKE ?
          OR CD_CELULAR_CLIENTE LIKE ?
        )
      ORDER BY NM_FANTASIA_CLIENTE
    `;

    db.query(sql, [termo, termo, termo, termo, termo], (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const clientes = rows.map(r => ({
        id: r.CD_CLIENTE,
        nome: (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
        razaoSocial: (r.NM_RAZ_SOC_CLIENTE || '').trim(),
        cpfCnpj: (r.CD_CGC_CLIENTE || '').trim(),
        telefone: (r.CD_FONE_CLIENTE || '').trim(),
        celular: (r.CD_CELULAR_CLIENTE || '').trim(),
        email: (r.DS_EMAIL_CLIENTE || '').trim(),
      }));

      return res.json({ ok: true, total: clientes.length, clientes });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// Buscar veículos de um cliente (via tabela VEICULOS)
router.get('/cliente/:id/veiculos', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();
    const cdCliente = parseInt(req.params.id);

    const sql = `
      SELECT
        V.CD_VEICULOS,
        V.DS_PLACA,
        V.DS_DESCRICAO,
        V.VL_KM_VEICULO,
        V.DT_ULTIMA_ENTRADA,
        V.DS_RENAVAN,
        V.DS_UF,
        M.DS_MARCA_VEICULO,
        MO.DS_MODELO_VEICULO
      FROM VEICULOS V
      LEFT JOIN MARCA_VEICULO M  ON M.CD_MARCA_VEICULO  = V.CD_MARCA_VEICULO
      LEFT JOIN MODELO_VEICULO MO ON MO.CD_MODELO_VEICULO = V.CD_MODELO_VEICULO
      WHERE V.CD_CLIENTE = ?
      ORDER BY V.DT_ULTIMA_ENTRADA DESC NULLS LAST
    `;

    db.query(sql, [cdCliente], (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const veiculos = rows.map(r => ({
        id: r.CD_VEICULOS,
        placa: (r.DS_PLACA || '').trim(),
        descricao: (r.DS_DESCRICAO || '').trim(),
        marca: (r.DS_MARCA_VEICULO || '').trim(),
        modelo: (r.DS_MODELO_VEICULO || '').trim(),
        km: r.VL_KM_VEICULO || 0,
        ultimaEntrada: r.DT_ULTIMA_ENTRADA,
        renavan: (r.DS_RENAVAN || '').trim(),
        uf: (r.DS_UF || '').trim(),
      }));

      return res.json({ ok: true, total: veiculos.length, veiculos });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// Buscar veículo por placa com dados do cliente
router.get('/veiculo/placa/:placa', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();
    const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const sql = `
      SELECT FIRST 1
        V.CD_VEICULOS,
        V.DS_PLACA,
        V.DS_DESCRICAO,
        V.VL_KM_VEICULO,
        V.DT_ULTIMA_ENTRADA,
        V.DS_RENAVAN,
        V.DS_UF,
        M.DS_MARCA_VEICULO,
        MO.DS_MODELO_VEICULO,
        C.CD_CLIENTE,
        C.NM_FANTASIA_CLIENTE,
        C.NM_RAZ_SOC_CLIENTE,
        C.CD_FONE_CLIENTE,
        C.CD_CELULAR_CLIENTE,
        C.DS_EMAIL_CLIENTE
      FROM VEICULOS V
      LEFT JOIN MARCA_VEICULO M  ON M.CD_MARCA_VEICULO  = V.CD_MARCA_VEICULO
      LEFT JOIN MODELO_VEICULO MO ON MO.CD_MODELO_VEICULO = V.CD_MODELO_VEICULO
      LEFT JOIN CLIENTE C ON C.CD_CLIENTE = V.CD_CLIENTE
      WHERE UPPER(REPLACE(REPLACE(V.DS_PLACA, '-', ''), ' ', '')) = ?
    `;

    db.query(sql, [placa], (err, rows) => {
      if (err) {
        db.detach();
        return res.status(500).json({ ok: false, erro: err.message });
      }
      if (!rows || rows.length === 0) {
        db.detach();
        return res.status(404).json({ ok: false, erro: 'Veículo não encontrado.' });
      }

      const r = rows[0];
      const veiculo = {
        id: r.CD_VEICULOS,
        placa: (r.DS_PLACA || '').trim(),
        descricao: (r.DS_DESCRICAO || '').trim(),
        marca: (r.DS_MARCA_VEICULO || '').trim(),
        modelo: (r.DS_MODELO_VEICULO || '').trim(),
        km: r.VL_KM_VEICULO || 0,
        ultimaEntrada: r.DT_ULTIMA_ENTRADA,
        renavan: (r.DS_RENAVAN || '').trim(),
        uf: (r.DS_UF || '').trim(),
        cliente: {
          id: r.CD_CLIENTE,
          nome: (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
          telefone: (r.CD_FONE_CLIENTE || '').trim(),
          celular: (r.CD_CELULAR_CLIENTE || '').trim(),
          email: (r.DS_EMAIL_CLIENTE || '').trim(),
        },
      };

      // Busca todas as OS do veículo na SAIDAS
      const sqlOSList = `
        SELECT FIRST 100
          S.CD_SAIDA,
          S.DT_EMISSAO,
          S.DT_SAIDA,
          S.DS_TIPO_SAIDA,
          S.DS_OBS_NOTA_SAI,
          S.VL_KM_VEICULO,
          S.DS_NUMERO_NOTA,
          COL.NM_COLABORADOR
        FROM SAIDAS S
        LEFT JOIN COLABORADOR COL ON COL.CD_COLABORADOR = S.CD_COLABORADOR
        WHERE S.CD_VEICULO = ?
          AND (S.CK_CANCELADA IS NULL OR S.CK_CANCELADA <> 'S')
        ORDER BY S.DT_EMISSAO DESC NULLS LAST, S.CD_SAIDA DESC
      `;

      db.query(sqlOSList, [r.CD_VEICULOS], (errOS, osRows) => {
        db.detach();
        if (errOS || !osRows || osRows.length === 0) {
          return res.json({ ok: true, veiculo, osList: [], ultimaOS: null });
        }

        const osList = osRows.map(os => {
          const tipo = (os.DS_TIPO_SAIDA || '').trim();
          return {
            id: os.CD_SAIDA,
            data: os.DT_EMISSAO,
            dataSaida: os.DT_SAIDA,
            numeroNota: (os.DS_NUMERO_NOTA || '').trim(),
            tipo,
            tipoLabel: labelTipo(tipo),
            observacao: (os.DS_OBS_NOTA_SAI || '').trim(),
            km: os.VL_KM_VEICULO || 0,
            colaborador: (os.NM_COLABORADOR || '').trim(),
          };
        });

        return res.json({
          ok: true,
          veiculo,
          osList,
          ultimaOS: osList[0], // mais recente por padrão
        });
      });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// Histórico de OS de um veículo — fonte: SAIDAS (tem CD_CLIENTE e CD_VEICULO)
router.get('/veiculo/:id/historico', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();
    const cdVeiculo = parseInt(req.params.id);

    const sql = `
      SELECT FIRST 50
        S.CD_SAIDA,
        S.DT_EMISSAO,
        S.DT_SAIDA,
        S.DS_NUMERO_NOTA,
        S.DS_SERIE,
        S.VL_TOTAL_NOTA,
        S.VL_KM_VEICULO,
        S.DS_OBS_NOTA_SAI,
        S.CK_CANCELADA,
        S.DS_TIPO_SAIDA,
        C.NM_FANTASIA_CLIENTE,
        C.NM_RAZ_SOC_CLIENTE,
        C.CD_FONE_CLIENTE,
        C.CD_CELULAR_CLIENTE,
        COL.NM_COLABORADOR
      FROM SAIDAS S
      LEFT JOIN CLIENTE C     ON C.CD_CLIENTE       = S.CD_CLIENTE
      LEFT JOIN COLABORADOR COL ON COL.CD_COLABORADOR = S.CD_COLABORADOR
      WHERE S.CD_VEICULO = ?
        AND (S.CK_CANCELADA IS NULL OR S.CK_CANCELADA <> 'S')
      ORDER BY S.DT_EMISSAO DESC
    `;

    db.query(sql, [cdVeiculo], (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const historico = rows.map(r => {
        const tipo = (r.DS_TIPO_SAIDA || '').trim();
        return {
          id: r.CD_SAIDA,
          dataEmissao: r.DT_EMISSAO,
          dataSaida: r.DT_SAIDA,
          numeroNota: (r.DS_NUMERO_NOTA || '').trim(),
          serie: (r.DS_SERIE || '').trim(),
          tipo,
          tipoLabel: labelTipo(tipo),
          valorTotal: (r.VL_TOTAL_NOTA || 0) / 100,
          km: r.VL_KM_VEICULO || 0,
          observacao: (r.DS_OBS_NOTA_SAI || '').trim(),
          cliente: (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
          telefone: (r.CD_FONE_CLIENTE || r.CD_CELULAR_CLIENTE || '').trim(),
          colaborador: (r.NM_COLABORADOR || '').trim(),
        };
      });

      return res.json({ ok: true, total: historico.length, historico });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// Histórico de OS de um cliente — fonte: SAIDAS (CD_CLIENTE)
router.get('/cliente/:id/historico', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();
    const cdCliente = parseInt(req.params.id);

    const sql = `
      SELECT FIRST 50
        S.CD_SAIDA,
        S.DT_EMISSAO,
        S.DT_SAIDA,
        S.DS_NUMERO_NOTA,
        S.VL_TOTAL_NOTA,
        S.VL_KM_VEICULO,
        S.DS_OBS_NOTA_SAI,
        S.DS_TIPO_SAIDA,
        V.DS_PLACA,
        MK.DS_MARCA_VEICULO,
        MO.DS_MODELO_VEICULO,
        COL.NM_COLABORADOR
      FROM SAIDAS S
      LEFT JOIN VEICULOS V      ON V.CD_VEICULOS        = S.CD_VEICULO
      LEFT JOIN MARCA_VEICULO MK ON MK.CD_MARCA_VEICULO = V.CD_MARCA_VEICULO
      LEFT JOIN MODELO_VEICULO MO ON MO.CD_MODELO_VEICULO = V.CD_MODELO_VEICULO
      LEFT JOIN COLABORADOR COL  ON COL.CD_COLABORADOR  = S.CD_COLABORADOR
      WHERE S.CD_CLIENTE = ?
        AND (S.CK_CANCELADA IS NULL OR S.CK_CANCELADA <> 'S')
      ORDER BY S.DT_EMISSAO DESC
    `;

    db.query(sql, [cdCliente], (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const historico = rows.map(r => {
        const tipo = (r.DS_TIPO_SAIDA || '').trim();
        return {
          id: r.CD_SAIDA,
          dataEmissao: r.DT_EMISSAO,
          dataSaida: r.DT_SAIDA,
          numeroNota: (r.DS_NUMERO_NOTA || '').trim(),
          tipo,
          tipoLabel: labelTipo(tipo),
          valorTotal: (r.VL_TOTAL_NOTA || 0) / 100,
          km: r.VL_KM_VEICULO || 0,
          observacao: (r.DS_OBS_NOTA_SAI || '').trim(),
          veiculo: {
            placa: (r.DS_PLACA || '').trim(),
            marca: (r.DS_MARCA_VEICULO || '').trim(),
            modelo: (r.DS_MODELO_VEICULO || '').trim(),
          },
          colaborador: (r.NM_COLABORADOR || '').trim(),
        };
      });

      return res.json({ ok: true, total: historico.length, historico });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// Detalhes completos de uma OS — cabeçalho da SAIDAS + itens da SAIDA_ITENS
router.get('/os/:id', async (req, res) => {
  let db;
  try {
    db = await connectFirebird();
    const cdSaida = parseInt(req.params.id);

    // Cabeçalho da OS vindo de SAIDAS com joins de cliente e veículo
    const sqlCabecalho = `
      SELECT FIRST 1
        S.CD_SAIDA,
        S.DT_EMISSAO,
        S.DT_SAIDA,
        S.DS_NUMERO_NOTA,
        S.DS_SERIE,
        S.DS_TIPO_SAIDA,
        S.VL_TOTAL_NOTA,
        S.VL_KM_VEICULO,
        S.DS_OBS_NOTA_SAI,
        C.CD_CLIENTE,
        C.NM_FANTASIA_CLIENTE,
        C.NM_RAZ_SOC_CLIENTE,
        C.CD_FONE_CLIENTE,
        C.CD_CELULAR_CLIENTE,
        V.CD_VEICULOS,
        V.DS_PLACA,
        V.DS_DESCRICAO AS DS_VEICULO,
        MK.DS_MARCA_VEICULO,
        MO.DS_MODELO_VEICULO,
        COL.NM_COLABORADOR
      FROM SAIDAS S
      LEFT JOIN CLIENTE C        ON C.CD_CLIENTE         = S.CD_CLIENTE
      LEFT JOIN VEICULOS V       ON V.CD_VEICULOS        = S.CD_VEICULO
      LEFT JOIN MARCA_VEICULO MK  ON MK.CD_MARCA_VEICULO  = V.CD_MARCA_VEICULO
      LEFT JOIN MODELO_VEICULO MO ON MO.CD_MODELO_VEICULO = V.CD_MODELO_VEICULO
      LEFT JOIN COLABORADOR COL   ON COL.CD_COLABORADOR   = S.CD_COLABORADOR
      WHERE S.CD_SAIDA = ?
    `;

    db.query(sqlCabecalho, [cdSaida], (errH, cabRows) => {
      if (errH) {
        db.detach();
        return res.status(500).json({ ok: false, erro: errH.message });
      }
      if (!cabRows || cabRows.length === 0) {
        db.detach();
        return res.status(404).json({ ok: false, erro: 'OS não encontrada.' });
      }

      const h = cabRows[0];
      const cabecalho = {
        id: h.CD_SAIDA,
        dataEmissao: h.DT_EMISSAO,
        dataSaida: h.DT_SAIDA,
        numeroNota: (h.DS_NUMERO_NOTA || '').trim(),
        serie: (h.DS_SERIE || '').trim(),
        tipoSaida: (h.DS_TIPO_SAIDA || '').trim(),
        valorTotal: (h.VL_TOTAL_NOTA || 0) / 100,
        km: h.VL_KM_VEICULO || 0,
        observacao: (h.DS_OBS_NOTA_SAI || '').trim(),
        colaborador: (h.NM_COLABORADOR || '').trim(),
        cliente: {
          id: h.CD_CLIENTE,
          nome: (h.NM_FANTASIA_CLIENTE || h.NM_RAZ_SOC_CLIENTE || '').trim(),
          telefone: (h.CD_FONE_CLIENTE || '').trim(),
          celular: (h.CD_CELULAR_CLIENTE || '').trim(),
        },
        veiculo: {
          id: h.CD_VEICULOS,
          placa: (h.DS_PLACA || '').trim(),
          descricao: (h.DS_VEICULO || '').trim(),
          marca: (h.DS_MARCA_VEICULO || '').trim(),
          modelo: (h.DS_MODELO_VEICULO || '').trim(),
        },
      };

      // Itens/peças da OS
      const sqlItens = `
        SELECT
          SI.CD_ITEM,
          P.DS_PRODUTO,
          SI.QT_PRODUTO,
          SI.VL_UNT_PRODUTO,
          SI.VL_TOTAL_PRODUTO,
          SI.VL_DESCONTO
        FROM SAIDA_ITENS SI
        LEFT JOIN PRODUTOS P ON P.CD_PRODUTO = SI.CD_PRODUTO
        WHERE SI.CD_SAIDA = ?
        ORDER BY SI.CD_ITEM
      `;

      db.query(sqlItens, [cdSaida], (errI, itenRows) => {
        db.detach();
        if (errI) return res.status(500).json({ ok: false, erro: errI.message });

        const itens = itenRows.map(i => ({
          item: i.CD_ITEM,
          produto: (i.DS_PRODUTO || '').trim(),
          quantidade: (i.QT_PRODUTO || 0) / 1000,
          valorUnitario: (i.VL_UNT_PRODUTO || 0) / 100,
          valorTotal: (i.VL_TOTAL_PRODUTO || 0) / 100,
          desconto: (i.VL_DESCONTO || 0) / 100,
        }));

        return res.json({ ok: true, cabecalho, itens });
      });
    });
  } catch (error) {
    if (db) db.detach();
    return res.status(500).json({ ok: false, erro: error.message });
  }
});

// ─── GET /api/checklist/veiculo/placa/:placa/os-abertas ──────────────────────
// Lista OSs abertas (não transmitidas) do veículo — para vincular ao card kanban
router.get('/veiculo/placa/:placa/os-abertas', async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let db;
  try {
    db = await connectFirebird();

    const sql = `
      SELECT FIRST 20
        s.CD_SAIDA,
        s.DT_EMISSAO,
        s.DT_PEDIDO,
        s.DS_NUMERO_NOTA,
        s.VL_TOTAL_NOTA,
        s.DS_TIPO_SAIDA,
        s.DS_OBS_NOTA_SAI,
        c.NM_FANTASIA_CLIENTE,
        c.NM_RAZ_SOC_CLIENTE
      FROM SAIDAS s
      INNER JOIN VEICULOS v ON v.CD_VEICULOS = s.CD_VEICULO
      LEFT  JOIN CLIENTE  c ON c.CD_CLIENTE  = s.CD_CLIENTE
      WHERE TRIM(v.DS_PLACA) = ?
        AND s.DT_TRANSMISSAO IS NULL
        AND (s.CK_CANCELADA IS NULL OR s.CK_CANCELADA <> 'T')
      ORDER BY s.DT_EMISSAO DESC
    `;

    db.query(sql, [placa], (err, rows) => {
      db.detach();
      if (err) return res.status(500).json({ ok: false, erro: err.message });

      const lista = (rows || []).map(r => ({
        cdSaida:    r.CD_SAIDA,
        dtEmissao:  r.DT_EMISSAO,
        dtPedido:   r.DT_PEDIDO,
        nrNota:     (r.DS_NUMERO_NOTA || '').trim(),
        vlTotal:    r.VL_TOTAL_NOTA,
        tipo:       labelTipo(r.DS_TIPO_SAIDA),
        obs:        (r.DS_OBS_NOTA_SAI || '').trim(),
        cliente:    (r.NM_FANTASIA_CLIENTE || r.NM_RAZ_SOC_CLIENTE || '').trim(),
      }));

      res.json({ ok: true, placa, total: lista.length, lista });
    });
  } catch (error) {
    if (db) db.detach();
    res.status(500).json({ ok: false, erro: error.message });
  }
});

module.exports = router;
