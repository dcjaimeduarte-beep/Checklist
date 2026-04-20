const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp   = require('sharp');

// Qualidade e dimensão máxima das fotos salvas no servidor
const FOTO_MAX_WIDTH  = 1600;
const FOTO_QUALITY    = 75;

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uploadsBase() {
  return process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.join(__dirname, '..', '..', 'uploads');
}

/** Pasta de uma sessão: {base}/{PLACA}/{sessao}  */
function sessaoDir(placa, sessao) {
  return path.join(uploadsBase(), placa.toUpperCase(), sessao);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Lista as sessões salvas para uma placa (mais recente primeiro). */
function listarSessoes(placa) {
  const dir = path.join(uploadsBase(), placa.toUpperCase());
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(name => {
      const jsonPath = path.join(dir, name, 'checklist.json');
      return fs.existsSync(jsonPath);
    })
    .sort((a, b) => b.localeCompare(a)); // mais recente primeiro (nome contém timestamp)
}

// ─── Multer — armazena em memória até sabermos o destino final ────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB por foto
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são aceitas.'));
    }
    cb(null, true);
  },
});

// ─── POST /api/vistoria/salvar ────────────────────────────────────────────────
// Body: multipart/form-data
//   dados  (campo text)  → JSON com todo o estado do checklist
//   fotos  (campos file) → imagens opcionais
router.post('/salvar', upload.array('fotos', 30), async (req, res) => {
  try {
    const { dados } = req.body;
    if (!dados) return res.status(400).json({ ok: false, erro: 'Campo "dados" é obrigatório.' });

    let checklist;
    try { checklist = JSON.parse(dados); } catch {
      return res.status(400).json({ ok: false, erro: 'Campo "dados" não é um JSON válido.' });
    }

    const placa = (checklist?.veiculo?.placa || 'SEM_PLACA').toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Sessão: YYYY-MM-DD_HHmmss_uuid-curto
    const now    = new Date();
    const datePart = now.toISOString().slice(0, 10);           // 2025-04-16
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, ''); // 143022
    const sessao = `${datePart}_${timePart}_${uuidv4().slice(0, 6)}`;

    const dir = sessaoDir(placa, sessao);
    ensureDir(dir);

    // Salvar fotos com compressão e montar lista de nomes
    const fotosNomes = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const nome = `foto_${String(i + 1).padStart(2, '0')}.jpg`;
        const destPath = path.join(dir, nome);
        // Redimensiona para no máximo FOTO_MAX_WIDTH e comprime em JPEG
        await sharp(file.buffer)
          .rotate()                             // corrige orientação EXIF
          .resize({ width: FOTO_MAX_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: FOTO_QUALITY, mozjpeg: true })
          .toFile(destPath);
        fotosNomes.push(nome);
      }
    }

    // Enriquecer o JSON com metadados e lista de fotos
    const payload = {
      ...checklist,
      _meta: {
        placa,
        sessao,
        savedAt: now.toISOString(),
        fotos: fotosNomes,
      },
    };

    fs.writeFileSync(path.join(dir, 'checklist.json'), JSON.stringify(payload, null, 2));

    return res.json({
      ok: true,
      sessao,
      placa,
      fotos: fotosNomes.length,
      savedAt: payload._meta.savedAt,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/historico/:placa ──────────────────────────────────────
// Lista todas as sessões salvas para uma placa.
router.get('/historico/:placa', (req, res) => {
  try {
    const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sessoes = listarSessoes(placa);

    const lista = sessoes.map(sessao => {
      const jsonPath = path.join(uploadsBase(), placa, sessao, 'checklist.json');
      try {
        const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return {
          sessao,
          savedAt: payload._meta?.savedAt || null,
          fotos:   payload._meta?.fotos?.length || 0,
          veiculo: payload.veiculo || null,
          motorista: payload.motorista?.nome || null,
        };
      } catch {
        return { sessao, savedAt: null, fotos: 0 };
      }
    });

    return res.json({ ok: true, placa, total: lista.length, lista });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/:placa/:sessao ────────────────────────────────────────
// Carrega uma sessão específica com URLs das fotos.
router.get('/:placa/:sessao', (req, res) => {
  try {
    const placa  = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sessao = req.params.sessao;

    const jsonPath = path.join(sessaoDir(placa, sessao), 'checklist.json');
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ ok: false, erro: 'Vistoria não encontrada.' });
    }

    const payload = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Montar URLs públicas das fotos
    const fotosUrls = (payload._meta?.fotos || []).map(nome =>
      `/uploads/${placa}/${sessao}/${nome}`
    );

    return res.json({ ok: true, checklist: payload, fotosUrls });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message });
  }
});

// ─── GET /api/vistoria/foto/:placa/:sessao/:arquivo ──────────────────────────
// Serve uma foto individualmente (fallback caso o static não esteja configurado).
router.get('/foto/:placa/:sessao/:arquivo', (req, res) => {
  const placa   = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const sessao  = req.params.sessao;
  const arquivo = path.basename(req.params.arquivo); // evita path traversal

  const filePath = path.join(sessaoDir(placa, sessao), arquivo);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, erro: 'Arquivo não encontrado.' });
  }
  res.sendFile(filePath);
});

module.exports = router;
