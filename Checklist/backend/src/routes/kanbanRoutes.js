const express              = require('express');
const { v4: uuidv4 }       = require('uuid');
const { getDb, rowToCard } = require('../config/database');
const { connectFirebird }  = require('../config/firebird');
const { addClient, removeClient, broadcast } = require('../services/sseClients');

const router = express.Router();

function allCards() {
  return getDb().prepare('SELECT * FROM kanban_cards ORDER BY criado_em').all().map(rowToCard);
}

// ─── GET /api/kanban/eventos — SSE ────────────────────────────────────────────
router.get('/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`event: init\ndata: ${JSON.stringify(allCards())}\n\n`);

  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(hb); } }, 25000);
  addClient(res);
  req.on('close', () => { removeClient(res); clearInterval(hb); });
});

// ─── GET /api/kanban/cards ────────────────────────────────────────────────────
router.get('/cards', (_req, res) => {
  res.json({ ok: true, cards: allCards() });
});

// ─── POST /api/kanban/card ────────────────────────────────────────────────────
router.post('/card', (req, res) => {
  const { placa, veiculo, cor, motorista, sessao, colaborador } = req.body;
  if (!placa) return res.status(400).json({ ok: false, erro: 'Placa obrigatória.' });

  const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const db = getDb();

  // Impede duplicata: retorna card existente ativo para a mesma placa
  const existente = db.prepare(
    'SELECT * FROM kanban_cards WHERE placa = ? AND concluido = 0 LIMIT 1'
  ).get(placaNorm);
  if (existente) {
    return res.json({ ok: true, jaExiste: true, card: rowToCard(existente) });
  }

  const now  = new Date().toISOString();
  const id   = uuidv4();
  const hist = JSON.stringify([{ status: 1, label: 'Aguardando Diagnóstico', entrada: now, saida: null }]);

  db.prepare(`
    INSERT INTO kanban_cards
      (id, placa, veiculo, cor, motorista, colaborador, sessao,
       status, concluido, concluido_em, criado_em, status_atualizado_em, historico_json)
    VALUES
      (@id, @placa, @veiculo, @cor, @motorista, @colaborador, @sessao,
       1, 0, NULL, @now, @now, @hist)
  `).run({ id, placa: placaNorm, veiculo: veiculo || '', cor: cor || '',
            motorista: motorista || '', colaborador: colaborador || '',
            sessao: sessao || null, now, hist });

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id));
  broadcast('card_added', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/status ───────────────────────────────────────
router.patch('/card/:id/status', (req, res) => {
  const s = Number(req.body.status);
  if (!s || s < 1) return res.status(400).json({ ok: false, erro: 'Status inválido.' });

  const db  = getDb();
  const row = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const now      = new Date().toISOString();
  const label    = req.body.label || `Status ${s}`;
  const historico = JSON.parse(row.historico_json);
  const cur = historico.find(h => h.saida === null);
  if (cur) cur.saida = now;
  historico.push({ status: s, label, entrada: now, saida: null });

  const patch = { status: s, now, hist: JSON.stringify(historico), id: req.params.id };

  if (req.body.colaborador !== undefined) {
    db.prepare(`
      UPDATE kanban_cards SET status = @status, status_atualizado_em = @now,
        historico_json = @hist, colaborador = @colaborador WHERE id = @id
    `).run({ ...patch, colaborador: req.body.colaborador });
  } else {
    db.prepare(`
      UPDATE kanban_cards SET status = @status, status_atualizado_em = @now,
        historico_json = @hist WHERE id = @id
    `).run(patch);
  }

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id));
  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/colaborador ──────────────────────────────────
router.patch('/card/:id/colaborador', (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT id FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  db.prepare('UPDATE kanban_cards SET colaborador = ? WHERE id = ?')
    .run(req.body.colaborador || '', req.params.id);

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id));
  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/concluido ────────────────────────────────────
router.patch('/card/:id/concluido', (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const concluido   = req.body.concluido !== false ? 1 : 0;
  const concluidoEm = concluido ? new Date().toISOString() : null;

  db.prepare('UPDATE kanban_cards SET concluido = ?, concluido_em = ? WHERE id = ?')
    .run(concluido, concluidoEm, req.params.id);

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id));

  // Ao marcar como entregue: sinaliza checklist concluído no Firebird
  if (concluido && card.cdSaida) {
    setImmediate(() => sinalizarConcluidoFirebird(card.cdSaida, card));
  }

  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/link-os ──────────────────────────────────────
router.patch('/card/:id/link-os', (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const cdSaida   = req.body.cdSaida   ? Number(req.body.cdSaida)   : null;
  const cdEmpresa = req.body.cdEmpresa ? Number(req.body.cdEmpresa) : 1;
  if (!cdSaida) return res.status(400).json({ ok: false, erro: 'cdSaida obrigatório.' });

  db.prepare('UPDATE kanban_cards SET cd_saida = ? WHERE id = ?').run(cdSaida, req.params.id);

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id));
  setImmediate(() => criarLinkFirebird(cdSaida, cdEmpresa, card));

  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── DELETE /api/kanban/card/:id ─────────────────────────────────────────────
router.delete('/card/:id', (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT id FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  db.prepare('DELETE FROM kanban_cards WHERE id = ?').run(req.params.id);
  broadcast('card_removed', { id: req.params.id });
  res.json({ ok: true });
});

// ─── Helpers Firebird (fire-and-forget, não bloqueiam HTTP) ──────────────────

async function criarLinkFirebird(cdSaida, cdEmpresa, card) {
  let fbDb;
  try {
    fbDb = await connectFirebird();
    const now = new Date();

    // Verifica se já existe vínculo para esta sessão (independente de qual OS estava antes)
    const existente = await new Promise((resolve, reject) => {
      fbDb.query(
        'SELECT CD_WEB_CHECKLIST_OS_LINK FROM WEB_CHECKLIST_OS_LINK WHERE DS_SESSAO_WEB = ? AND CD_EMPRESA = ?',
        [card.sessao || '', cdEmpresa],
        (err, rows) => { if (err) reject(err); else resolve(rows && rows.length > 0 ? rows[0] : null); }
      );
    });

    if (existente) {
      // Atualiza para a nova OS (revínculo)
      await new Promise((resolve, reject) => {
        fbDb.query(
          `UPDATE WEB_CHECKLIST_OS_LINK
           SET CD_SAIDA = ?, DS_COLABORADOR = ?, CK_CHECKLIST_CONCLUIDO = 'F', CK_NF_EMITIDA = 'F',
               DS_NUMERO_NF = NULL, DT_NF_EMITIDA = NULL
           WHERE DS_SESSAO_WEB = ? AND CD_EMPRESA = ?`,
          [cdSaida, card.colaborador || '', card.sessao || '', cdEmpresa],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });
    } else {
      await new Promise((resolve, reject) => {
        fbDb.query(
          `INSERT INTO WEB_CHECKLIST_OS_LINK
           (CD_EMPRESA, CD_SAIDA, DS_SESSAO_WEB, DS_COLABORADOR,
            DT_CHECKLIST, HR_CHECKLIST, CK_CHECKLIST_CONCLUIDO, CK_NF_EMITIDA)
           VALUES (?, ?, ?, ?, ?, ?, 'F', 'F')`,
          [cdEmpresa, cdSaida, card.sessao || '', card.colaborador || '', now, now],
          (err) => { if (err) reject(err); else resolve(); }
        );
      });
    }

    fbDb.detach();
  } catch (err) {
    if (fbDb) try { fbDb.detach(); } catch {}
    console.error('[Firebird] criarLinkFirebird erro:', err.message);
  }
}

async function sinalizarConcluidoFirebird(cdSaida, card) {
  let fbDb;
  try {
    fbDb = await connectFirebird();
    const obs = card.colaborador
      ? `Checklist concluído. Técnico: ${card.colaborador}.`
      : 'Checklist concluído.';

    await new Promise((resolve, reject) => {
      fbDb.query(
        `UPDATE WEB_CHECKLIST_OS_LINK
         SET CK_CHECKLIST_CONCLUIDO = 'T', DS_OBSERVACAO = ?
         WHERE CD_SAIDA = ? AND CK_CHECKLIST_CONCLUIDO = 'F'`,
        [obs, cdSaida],
        (err) => { if (err) reject(err); else resolve(); }
      );
    });

    fbDb.detach();
  } catch (err) {
    if (fbDb) try { fbDb.detach(); } catch {}
    console.error('[Firebird] sinalizarConcluidoFirebird erro:', err.message);
  }
}

module.exports = router;
