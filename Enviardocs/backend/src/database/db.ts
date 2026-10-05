import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { logInfo } from "../utils/logger";

const DATA_DIR = process.env.DATA_PATH ?? path.resolve(__dirname, "../../data");
const DB_FILE  = path.join(DATA_DIR, "enviardocs.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_FILE);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("wal_checkpoint(PASSIVE)");

  logInfo("Banco conectado", { file: DB_FILE });
  return _db;
}

/** Grava o histórico no arquivo do banco antes de encerrar o processo. */
export function fecharBanco(): void {
  if (!_db) return;
  try {
    _db.pragma("wal_checkpoint(TRUNCATE)");
    _db.close();
  } catch {
    try { _db.close(); } catch { /* o processo está encerrando */ }
  }
  _db = null;
}
