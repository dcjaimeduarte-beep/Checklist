const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb, rowToCard } = require('../config/database');

const router  = express.Router();
const clients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => { try { c.write(msg); } catch { clients.delete(c); } });
}

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
  clients.add(res);
  req.on('close', () => { clients.delete(res); clearInterval(hb); });
});

// ─── GET /api/kanban/cards ────────────────────────────────────────────────────
router.get('/cards', (req, res) => {
  res.json({ ok: true, cards: allCards() });
});

// ─── POST /api/kanban/card ────────────────────────────────────────────────────
router.post('/card', (req, res) => {
  const { placa, veiculo, cor, motorista, sessao, colaborador } = req.body;
  if (!placa) return res.status(400).json({ ok: false, erro: 'Placa obrigatória.' });

  const now  = new Date().toISOString();
  const id   = uuidv4();
  const hist = JSON.stringify([{ status: 1, label: 'Aguardando Diagnóstico', entrada: now, saida: null }]);
  const placaNorm = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

  getDb().prepare(`
    INSERT INTO kanban_cards
      (id, placa, veiculo, cor, motorista, colaborador, sessao,
       status, concluido, concluido_em, criado_em, status_atualizado_em, historico_json)
    VALUES
      (@id, @placa, @veiculo, @cor, @motorista, @colaborador, @sessao,
       1, 0, NULL, @now, @now, @hist)
  `).run({ id, placa: placaNorm, veiculo: veiculo || '', cor: cor || '',
            motorista: motorista || '', colaborador: colaborador || '',
            sessao: sessao || null, now, hist });

  const card = rowToCard(getDb().prepare('SELECT * FROM kanban_cards WHERE id = ?').get(id));
  broadcast('card_added', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/status ───────────────────────────────────────
router.patch('/card/:id/status', (req, res) => {
  const s = Number(req.body.status);
  if (!s || s < 1) return res.status(400).json({ ok: false, erro: 'Status inválido.' });

  const db   = getDb();
  const row  = db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const now      = new Date().toISOString();
  const label    = req.body.label || `Status ${s}`;
  const historico = JSON.parse(row.historico_json);
  const cur = historico.find(h => h.saida === null);
  if (cur) cur.saida = now;
  historico.push({ status: s, label, entrada: now, saida: null });

  const patch = {
    status:    s,
    now,
    hist:      JSON.stringify(historico),
    id:        req.params.id,
  };

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
  const db = getDb();
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
  const db = getDb();
  const row = db.prepare('SELECT id FROM kanban_cards WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const concluido   = req.body.concluido !== false ? 1 : 0;
  const concluidoEm = concluido ? new Date().toISOString() : null;

  db.prepare('UPDATE kanban_cards SET concluido = ?, concluido_em = ? WHERE id = ?')
    .run(concluido, concluidoEm, req.params.id);

  const card = rowToCard(db.prepare('SELECT * FROM kanban_cards WHERE id = ?').get(req.params.id));
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

module.exports = router;
