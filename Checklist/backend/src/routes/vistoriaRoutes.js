const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp   = require('sharp');
const { getDb } = require('../config/database');

const FOTO_MAX_WIDTH  = 1600;
const FOTO_QUALITY    = 75;

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uploadsBase() {
  return process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.join(__dirname, '..', '..', 'uploads');
}

function sessaoDir(placa, sessao) {
  return path.join(uploadsBase(), placa.toUpperCase(), sessao);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ─── Multer — armazena em memória até sabermos o destino final ────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas imagens e PDF são aceitos.'));
    }
    cb(null, true);
  },
});

// ─── POST /api/vistoria/salvar ────────────────────────────────────────────────
router.post('/salvar', upload.fields([{ name: 'fotos', maxCount: 30 }, { name: 'pdf', maxCount: 1 }]), async (req, res) => {
  try {
    const { dados } = req.body;
    if (!dados) return res.status(400).json({ ok: false, erro: 'Campo "dados" é obrigatório.' });

    let checklist;
    try { checklist = JSON.parse(dados); } catch {
      return res.status(400).json({ ok: false, erro: 'Campo "dados" não é um JSON válido.' });
    }

    const placa = (checklist?.veiculo?.placa || 'SEM_PLACA').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const now      = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const sessao   = `${datePart}_${timePart}_${uuidv4().slice(0, 6)}`;

    const dir = sessaoDir(placa, sessao);
    ensureDir(dir);

    // Salvar fotos com compressão
    const fotosNomes = [];
    for (let i = 0; i < (req.files?.fotos || []).length; i++) {
      const file = req.files.fotos[i];
      const nome = `foto_${String(i + 1).padStart(2, '0')}.jpg`;
      await sharp(file.buffer)
        .rotate()
        .resize({ width: FOTO_MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: FOTO_QUALITY, mozjpeg: true })
        .toFile(path.join(dir, nome));
      fotosNomes.push(nome);
    }

    // Salvar PDF
    let pdfNome = null;
    if ((req.files?.pdf || []).length > 0) {
      pdfNome = `checklist_${placa}.pdf`;
      fs.writeFileSync(path.join(dir, pdfNome), req.files.pdf[0].buffer);
    }

    const payload = {
      ...checklist,
      _meta: { placa, sessao, savedAt: now.toISOString(), fotos: fotosNomes, pdf: pdfNome },
    };

    // Persistir no SQLite
    getDb().prepare(`
      INSERT OR REPLACE INTO vistorias (id, placa, dados_json, fotos_json, pdf_nome, criado_em)
      VALUES (@id, @placa, @dados_json, @fotos_json, @pdf_nome, @criado_em)
    `).run({
      id:        sessao,
      placa,
      dados_json: JSON.stringify(payload),
      fotos_json: JSON.stringify(fotosNomes),
      pdf_nome:   pdfNome,
      criado_em:  now.toISOString(),
    });

    // Manter checklist.json no disco (backup / compatibilidade com migração)
    fs.writeFileSync(path.join(dir, 'checklist.json'), JSON.stringify(payload, null, 2));

    return res.json({ ok: true, sessao, placa, fotos: fotosNomes.length, savedAt: payload._meta.savedAt });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/historico/:placa ──────────────────────────────────────
router.get('/historico/:placa', (req, res) => {
  try {
    const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const rows = getDb().prepare(
      'SELECT id, dados_json, fotos_json, criado_em FROM vistorias WHERE placa = ? ORDER BY criado_em DESC'
    ).all(placa);

    const lista = rows.map(row => {
      let dados = {};
      try { dados = JSON.parse(row.dados_json); } catch {}
      let fotos = [];
      try { fotos = JSON.parse(row.fotos_json); } catch {}
      return {
        sessao:    row.id,
        savedAt:   row.criado_em,
        fotos:     fotos.length,
        veiculo:   dados.veiculo   || null,
        motorista: dados.motorista?.nome || null,
      };
    });

    return res.json({ ok: true, placa, total: lista.length, lista });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/:placa/:sessao ────────────────────────────────────────
router.get('/:placa/:sessao', (req, res) => {
  try {
    const placa  = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sessao = req.params.sessao;

    const row = getDb().prepare('SELECT * FROM vistorias WHERE id = ?').get(sessao);
    if (!row) return res.status(404).json({ ok: false, erro: 'Vistoria não encontrada.' });

    let payload = {};
    try { payload = JSON.parse(row.dados_json); } catch {}
    let fotos = [];
    try { fotos = JSON.parse(row.fotos_json); } catch {}

    const fotosUrls = fotos.map(nome => `/uploads/${placa}/${sessao}/${nome}`);

    return res.json({ ok: true, checklist: payload, fotosUrls });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/foto/:placa/:sessao/:arquivo ──────────────────────────
router.get('/foto/:placa/:sessao/:arquivo', (req, res) => {
  const placa   = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sessao  = req.params.sessao;
  const arquivo = path.basename(req.params.arquivo);

  const filePath = path.join(sessaoDir(placa, sessao), arquivo);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, erro: 'Arquivo não encontrado.' });
  }
  res.sendFile(filePath);
});

module.exports = router;
