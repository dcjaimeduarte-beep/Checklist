const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const bancoRoutes     = require('./routes/bancoRoutes');
const checklistRoutes = require('./routes/checklistRoutes');
const vistoriaRoutes  = require('./routes/vistoriaRoutes');
const kanbanRoutes    = require('./routes/kanbanRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Servir frontend buildado (produção)
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Servir uploads de fotos (vistorias)
const uploadsPath = process.env.UPLOADS_PATH
  ? require('path').resolve(process.env.UPLOADS_PATH)
  : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Rotas da API
app.use('/api/banco',     bancoRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/vistoria',  vistoriaRoutes);
app.use('/api/kanban',    kanbanRoutes);

// SPA fallback — qualquer rota que não seja /api retorna o index.html
app.get('/{*path}', (_req, res) => {
  const index = path.join(publicPath, 'index.html');
  res.sendFile(index, (err) => {
    if (err) {
      res.status(200).json({ ok: true, mensagem: 'API do checklist automotivo está rodando.' });
    }
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // aceita conexões de qualquer máquina da rede

app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Acessível na rede em http://SEU_IP:${PORT}`);
});
