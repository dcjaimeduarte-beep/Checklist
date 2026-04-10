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

  logInfo("Banco conectado", { file: DB_FILE });
  return _db;
}
