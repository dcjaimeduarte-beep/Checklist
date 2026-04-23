const express = require('express');
const fs      = require('fs');
const path    = require('path');
const { v4: uuidv4 } = require('uuid');

const router  = express.Router();
const clients = new Set();

const STATUS_LABELS = [
  '',
  'Aguardando Diagnóstico',
  'Em Diagnóstico',
  'Aguardando Aprovação',
  'Aguardando Peças',
  'Em Programação',
  'Em Serviço',
  'Finalizado',
  'OS Fechada',
  'Aguardando Cliente Buscar',
];

function dbPath() {
  const base = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH, '..', 'data')
    : path.join(__dirname, '..', '..', 'data');
  return path.join(base, 'kanban.json');
}

function readDb() {
  const p = dbPath();
  if (!fs.existsSync(p)) return { cards: [] };
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { cards: [] }; }
}

function writeDb(db) {
  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(db, null, 2));
}

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(c => { try { c.write(msg); } catch { clients.delete(c); } });
}

// ─── GET /api/kanban/eventos — SSE ────────────────────────────────────────────
router.get('/eventos', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const db = readDb();
  res.write(`event: init\ndata: ${JSON.stringify(db.cards)}\n\n`);

  // Heartbeat a cada 25s para manter conexão viva
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { clearInterval(hb); } }, 25000);

  clients.add(res);
  req.on('close', () => { clients.delete(res); clearInterval(hb); });
});

// ─── GET /api/kanban/cards ────────────────────────────────────────────────────
router.get('/cards', (req, res) => {
  const db = readDb();
  res.json({ ok: true, cards: db.cards });
});

// ─── POST /api/kanban/card ────────────────────────────────────────────────────
router.post('/card', (req, res) => {
  const { placa, veiculo, cor, motorista, sessao, colaborador } = req.body;
  if (!placa) return res.status(400).json({ ok: false, erro: 'Placa obrigatória.' });

  const db  = readDb();
  const now = new Date().toISOString();

  const card = {
    id: uuidv4(),
    placa: placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    veiculo:     veiculo     || '',
    cor:         cor         || '',
    motorista:   motorista   || '',
    colaborador: colaborador || '',
    sessao:      sessao      || null,
    concluido:   false,
    concluidoEm: null,
    status: 1,
    criadoEm:           now,
    statusAtualizadoEm: now,
    historico: [
      { status: 1, label: STATUS_LABELS[1], entrada: now, saida: null },
    ],
  };

  db.cards.push(card);
  writeDb(db);
  broadcast('card_added', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/status ───────────────────────────────────────
router.patch('/card/:id/status', (req, res) => {
  const s = Number(req.body.status);
  if (!s || s < 1) return res.status(400).json({ ok: false, erro: 'Status inválido.' });

  const db   = readDb();
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const now   = new Date().toISOString();
  const label = req.body.label || STATUS_LABELS[s] || `Status ${s}`;
  const cur   = card.historico.find(h => h.saida === null);
  if (cur) cur.saida = now;

  card.status             = s;
  card.statusAtualizadoEm = now;
  if (req.body.colaborador !== undefined) card.colaborador = req.body.colaborador;
  card.historico.push({ status: s, label, entrada: now, saida: null });

  writeDb(db);
  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/colaborador ──────────────────────────────────
router.patch('/card/:id/colaborador', (req, res) => {
  const db   = readDb();
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  card.colaborador = req.body.colaborador || '';
  writeDb(db);
  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── PATCH /api/kanban/card/:id/concluido ────────────────────────────────────
router.patch('/card/:id/concluido', (req, res) => {
  const db   = readDb();
  const card = db.cards.find(c => c.id === req.params.id);
  if (!card) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const concluido = req.body.concluido !== false; // default true
  card.concluido   = concluido;
  card.concluidoEm = concluido ? new Date().toISOString() : null;

  writeDb(db);
  broadcast('card_updated', card);
  res.json({ ok: true, card });
});

// ─── DELETE /api/kanban/card/:id ─────────────────────────────────────────────
router.delete('/card/:id', (req, res) => {
  const db  = readDb();
  const idx = db.cards.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, erro: 'Card não encontrado.' });

  const [card] = db.cards.splice(idx, 1);
  writeDb(db);
  broadcast('card_removed', { id: card.id });
  res.json({ ok: true });
});

module.exports = router;
