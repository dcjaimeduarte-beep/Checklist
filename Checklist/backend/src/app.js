const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bancoRoutes = require('./routes/bancoRoutes');
const checklistRoutes = require('./routes/checklistRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    ok: true,
    mensagem: 'API do checklist automotivo está rodando.'
  });
});

app.use('/api/banco', bancoRoutes);
app.use('/api/checklist', checklistRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
