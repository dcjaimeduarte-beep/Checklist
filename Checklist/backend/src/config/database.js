const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// ─── Caminho do banco ─────────────────────────────────────────────────────────

function dbPath() {
  const base = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH, '..', 'data')
    : path.join(__dirname, '..', '..', 'data');
  return path.join(base, 'checklist.db');
}

// ─── Instância única (singleton) ─────────────────────────────────────────────

let _db = null;

function getDb() {
  if (_db) return _db;

  const p = dbPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });

  _db = new Database(p);
  _db.pragma('journal_mode = WAL');  // leituras concorrentes sem travar escrita
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  migrateFromFiles(_db);

  return _db;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      name   TEXT PRIMARY KEY,
      run_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vistorias (
      id         TEXT PRIMARY KEY,
      placa      TEXT NOT NULL,
      dados_json TEXT NOT NULL,
      fotos_json TEXT NOT NULL DEFAULT '[]',
      pdf_nome   TEXT,
      criado_em  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vistorias_placa   ON vistorias(placa);
    CREATE INDEX IF NOT EXISTS idx_vistorias_criado  ON vistorias(criado_em DESC);

    CREATE TABLE IF NOT EXISTS kanban_cards (
      id                   TEXT PRIMARY KEY,
      placa                TEXT NOT NULL,
      veiculo              TEXT NOT NULL DEFAULT '',
      cor                  TEXT NOT NULL DEFAULT '',
      motorista            TEXT NOT NULL DEFAULT '',
      colaborador          TEXT NOT NULL DEFAULT '',
      sessao               TEXT,
      status               INTEGER NOT NULL DEFAULT 1,
      concluido            INTEGER NOT NULL DEFAULT 0,
      concluido_em         TEXT,
      criado_em            TEXT NOT NULL,
      status_atualizado_em TEXT NOT NULL,
      historico_json       TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_kanban_placa     ON kanban_cards(placa);
    CREATE INDEX IF NOT EXISTS idx_kanban_status    ON kanban_cards(status);
    CREATE INDEX IF NOT EXISTS idx_kanban_concluido ON kanban_cards(concluido);
  `);
}

// ─── Migração automática de dados existentes (roda só uma vez) ───────────────

function migrateFromFiles(db) {
  const jaRodou = db.prepare(`SELECT 1 FROM migrations WHERE name = 'v1_files'`).get();
  if (jaRodou) return;

  let vistorias = 0;
  let kanban    = 0;

  // ── Vistorias: ler checklist.json de cada sessão ──────────────────────────
  const uploadsBase = process.env.UPLOADS_PATH
    ? path.resolve(process.env.UPLOADS_PATH)
    : path.join(__dirname, '..', '..', 'uploads');

  const insertVistoria = db.prepare(`
    INSERT OR IGNORE INTO vistorias (id, placa, dados_json, fotos_json, pdf_nome, criado_em)
    VALUES (@id, @placa, @dados_json, @fotos_json, @pdf_nome, @criado_em)
  `);

  if (fs.existsSync(uploadsBase)) {
    for (const placa of fs.readdirSync(uploadsBase)) {
      const placaDir = path.join(uploadsBase, placa);
      if (!fs.statSync(placaDir).isDirectory()) continue;
      for (const sessao of fs.readdirSync(placaDir)) {
        const jsonFile = path.join(placaDir, sessao, 'checklist.json');
        if (!fs.existsSync(jsonFile)) continue;
        try {
          const payload  = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
          const criadoEm = payload._meta?.savedAt || new Date().toISOString();
          const fotos    = payload._meta?.fotos   || [];
          const pdfNome  = payload._meta?.pdf     || null;
          insertVistoria.run({
            id:         sessao,
            placa:      placa.toUpperCase(),
            dados_json: JSON.stringify(payload),
            fotos_json: JSON.stringify(fotos),
            pdf_nome:   pdfNome,
            criado_em:  criadoEm,
          });
          vistorias++;
        } catch { /* ignora sessão corrompida */ }
      }
    }
  }

  // ── Kanban: ler kanban.json ───────────────────────────────────────────────
  const kanbanFile = process.env.UPLOADS_PATH
    ? path.join(path.resolve(process.env.UPLOADS_PATH, '..', 'data'), 'kanban.json')
    : path.join(__dirname, '..', '..', 'data', 'kanban.json');

  const insertCard = db.prepare(`
    INSERT OR IGNORE INTO kanban_cards
      (id, placa, veiculo, cor, motorista, colaborador, sessao,
       status, concluido, concluido_em, criado_em, status_atualizado_em, historico_json)
    VALUES
      (@id, @placa, @veiculo, @cor, @motorista, @colaborador, @sessao,
       @status, @concluido, @concluido_em, @criado_em, @status_atualizado_em, @historico_json)
  `);

  if (fs.existsSync(kanbanFile)) {
    try {
      const { cards } = JSON.parse(fs.readFileSync(kanbanFile, 'utf8'));
      for (const c of cards || []) {
        insertCard.run({
          id:                   c.id,
          placa:                c.placa,
          veiculo:              c.veiculo              || '',
          cor:                  c.cor                  || '',
          motorista:            c.motorista            || '',
          colaborador:          c.colaborador          || '',
          sessao:               c.sessao               || null,
          status:               c.status               || 1,
          concluido:            c.concluido ? 1 : 0,
          concluido_em:         c.concluidoEm          || null,
          criado_em:            c.criadoEm,
          status_atualizado_em: c.statusAtualizadoEm,
          historico_json:       JSON.stringify(c.historico || []),
        });
        kanban++;
      }
    } catch { /* ignora arquivo corrompido */ }
  }

  db.prepare(`INSERT INTO migrations (name, run_at) VALUES ('v1_files', ?)`).run(new Date().toISOString());
  console.log(`[DB] Migração concluída: ${vistorias} vistorias, ${kanban} cards do kanban importados.`);
}

// ─── Helpers de conversão ─────────────────────────────────────────────────────

function rowToCard(row) {
  return {
    id:                 row.id,
    placa:              row.placa,
    veiculo:            row.veiculo,
    cor:                row.cor,
    motorista:          row.motorista,
    colaborador:        row.colaborador,
    sessao:             row.sessao,
    status:             row.status,
    concluido:          row.concluido === 1,
    concluidoEm:        row.concluido_em,
    criadoEm:           row.criado_em,
    statusAtualizadoEm: row.status_atualizado_em,
    historico:          JSON.parse(row.historico_json),
  };
}

module.exports = { getDb, rowToCard };
