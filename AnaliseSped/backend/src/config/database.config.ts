import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { type TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Caminho do arquivo SQLite. Relativo ao cwd do processo (pasta `backend/` ao rodar scripts).
 * Em produção futura com PostgreSQL, substituir por opções `postgres` e variáveis de ambiente dedicadas.
 */
export function getDatabasePath(): string {
  const raw = process.env.DATABASE_PATH;
  if (!raw) {
    return join(process.cwd(), 'data', 'app.sqlite');
  }
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

/** Garante que o diretório pai do arquivo .sqlite exista antes do driver abrir o arquivo. */
export function ensureDatabaseDirectory(): void {
  const dbPath = getDatabasePath();
  mkdirSync(dirname(dbPath), { recursive: true });
}

/**
 * TypeORM + SQLite (better-sqlite3). Migração futura para PostgreSQL: trocar `type` e credenciais,
 * mantendo entidades e repositórios; usar migrations em vez de `synchronize` em produção.
 */
export function typeOrmSqliteConfig(): TypeOrmModuleOptions {
  return {
    type: 'better-sqlite3',
    database: getDatabasePath(),
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
  };
}
