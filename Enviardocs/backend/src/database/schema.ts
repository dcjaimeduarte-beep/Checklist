/**
 * Criação e migração das tabelas do banco.
 * Chamado na inicialização do servidor — idempotente (IF NOT EXISTS).
 *
 * Tabelas:
 *  - clients        : cadastro de clientes
 *  - client_emails  : e-mails (1 cliente → N e-mails)
 *  - send_log       : histórico de envios
 */
import { getDb } from './db';

export function runMigrations(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      cnpj            TEXT,
      contact_name    TEXT,
      phone           TEXT,
      delivery_method TEXT    NOT NULL DEFAULT 'email',
      regime          TEXT,
      section         TEXT    NOT NULL DEFAULT 'nota_fiscal',
      folder_name     TEXT,
      notes           TEXT,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS client_emails (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      email      TEXT    NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(client_id, email)
    );

    CREATE TABLE IF NOT EXISTS send_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id     INTEGER NOT NULL REFERENCES clients(id),
      month         TEXT    NOT NULL,
      files_count   INTEGER NOT NULL DEFAULT 0,
      status        TEXT    NOT NULL CHECK(status IN ('success','error','skipped')),
      error_message TEXT,
      sent_at       TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clients_active    ON clients(active);
    CREATE INDEX IF NOT EXISTS idx_clients_cnpj      ON clients(cnpj);
    CREATE INDEX IF NOT EXISTS idx_emails_client     ON client_emails(client_id);
    CREATE INDEX IF NOT EXISTS idx_sendlog_client    ON send_log(client_id);
    CREATE INDEX IF NOT EXISTS idx_sendlog_month     ON send_log(month);
  `);

  // Migration incremental: adiciona coluna de nomes de arquivos enviados
  try { db.exec("ALTER TABLE send_log ADD COLUMN files_json TEXT"); } catch { /* já existe */ }
}
