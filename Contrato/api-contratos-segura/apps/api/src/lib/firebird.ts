import Firebird from "node-firebird";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./prisma.js";
import { env } from "../env.js";

export type ResolvedDatabasePath = {
  path: string;
  corrected: boolean;
};

export class FbPathError extends Error {
  readonly suggestions: { path: string; name: string }[];

  constructor(message: string, suggestions: string[] = []) {
    super(message);
    this.name = "FbPathError";
    this.suggestions = suggestions.map((p) => ({ path: p, name: path.basename(p) }));
  }
}

export function findSimilarFdbFiles(input: string): { path: string; name: string }[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const dir = path.dirname(trimmed);
  const base = path.basename(trimmed).replace(/\.(fdb|gdb)$/i, "");
  return listSimilarFdbFiles(dir, base).map((p) => ({ path: p, name: path.basename(p) }));
}

function listSimilarFdbFiles(dir: string, baseName: string): string[] {
  try {
    const norm = baseName.toUpperCase();
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(fdb|gdb)$/i.test(f))
      .filter((f) => f.toUpperCase().includes(norm))
      .sort((a, b) => b.localeCompare(a))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function formatPathError(trimmed: string, similar: string[]): string {
  if (similar.length === 1) {
    return (
      `Arquivo não encontrado: "${path.basename(trimmed)}". ` +
      `O mais parecido é: ${path.basename(similar[0] ?? "")}. Selecione-o em Procurar.`
    );
  }
  if (similar.length > 1) {
    const list = similar.slice(0, 6).map((p) => `• ${path.basename(p)}`).join("\n");
    return (
      `Arquivo "${path.basename(trimmed)}" não existe nesta pasta.\n` +
      `Existem ${similar.length} arquivos parecidos — escolha o correto em Procurar:\n${list}`
    );
  }
  return (
    `Arquivo do banco não encontrado: "${trimmed}". ` +
    `Use Procurar e selecione o arquivo .FDB completo (ex.: Solutio_SEVEN_naseven_07042026.FDB).`
  );
}

/** Garante caminho para arquivo .fdb/.gdb existente no disco (API local). */
export function resolveDatabasePath(input: string): ResolvedDatabasePath {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Caminho do banco (.fdb) não informado.");
  }

  const ext = path.extname(trimmed).toLowerCase();
  const candidates = ext
    ? [trimmed]
    : [`${trimmed}.FDB`, `${trimmed}.fdb`, `${trimmed}.GDB`, `${trimmed}.gdb`, trimmed];

  for (const candidate of candidates) {
    try {
      const stat = fs.statSync(candidate);
      if (stat.isFile()) {
        return { path: candidate, corrected: candidate !== trimmed };
      }
    } catch {
      /* tenta próximo candidato */
    }
  }

  const dir = path.dirname(trimmed);
  const base = path.basename(trimmed).replace(/\.(fdb|gdb)$/i, "");
  const similar = listSimilarFdbFiles(dir, base);

  if (similar.length === 1 && similar[0]) {
    return { path: similar[0], corrected: true };
  }

  throw new FbPathError(formatPathError(trimmed, similar), similar);
}

export type FbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

/** Retorna true quando o host aponta para a própria máquina (sem acesso ao disco remoto). */
export function isLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "";
}

// Lê configuração salva no banco; cai no .env como fallback
export async function getFbConfig(): Promise<FbConfig | null> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { startsWith: "firebird." } },
  });

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  const rawDatabase = map["firebird.database"] ?? env.FB_DATABASE;
  if (!rawDatabase) return null;

  const host = map["firebird.host"] || env.FB_HOST || "localhost";

  let database = rawDatabase;
  if (isLocalHost(host)) {
    try {
      database = resolveDatabasePath(rawDatabase).path;
    } catch {
      database = rawDatabase;
    }
  }

  return {
    host,
    port:     Number(map["firebird.port"] || env.FB_PORT || 3050),
    database,
    user:     map["firebird.user"]     || env.FB_USER     || "SYSDBA",
    password: map["firebird.password"] || env.FB_PASSWORD || "masterkey",
  };
}

/** Resolve o caminho do banco apenas quando o host é local. Para hosts remotos retorna a config sem alteração. */
export function resolveDbPathIfLocal(cfg: FbConfig): { cfg: FbConfig; corrected: boolean } {
  if (!isLocalHost(cfg.host)) return { cfg, corrected: false };
  try {
    const resolved = resolveDatabasePath(cfg.database);
    return { cfg: { ...cfg, database: resolved.path }, corrected: resolved.corrected };
  } catch (e) {
    throw e;
  }
}

export function fbConfigSource(map: Record<string, string>): "saved" | "env" | "none" {
  if (map["firebird.database"]) return "saved";
  if (env.FB_DATABASE) return "env";
  return "none";
}

export async function saveFbConfig(cfg: Partial<FbConfig>): Promise<void> {
  const entries: { key: string; value: string }[] = [];
  if (cfg.host     !== undefined) entries.push({ key: "firebird.host",     value: cfg.host });
  if (cfg.port     !== undefined) entries.push({ key: "firebird.port",     value: String(cfg.port) });
  if (cfg.database !== undefined) {
    let effectiveHost = cfg.host ?? entries.find((e) => e.key === "firebird.host")?.value;
    if (!effectiveHost) {
      const saved = await prisma.systemConfig.findUnique({ where: { key: "firebird.host" } });
      effectiveHost = saved?.value ?? "localhost";
    }
    if (isLocalHost(effectiveHost)) {
      const resolved = resolveDatabasePath(cfg.database);
      entries.push({ key: "firebird.database", value: resolved.path });
    } else {
      entries.push({ key: "firebird.database", value: cfg.database.trim() });
    }
  }
  if (cfg.user     !== undefined) entries.push({ key: "firebird.user",     value: cfg.user });
  if (cfg.password !== undefined && cfg.password !== "") {
    entries.push({ key: "firebird.password", value: cfg.password });
  }

  for (const { key, value } of entries) {
    await prisma.systemConfig.upsert({
      where:  { key },
      create: { key, value },
      update: { value },
    });
  }
}

export function fbQueryWithConfig<T = Record<string, unknown>>(
  cfg: FbConfig,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const options = {
    host:           cfg.host,
    port:           cfg.port,
    database:       cfg.database,
    user:           cfg.user,
    password:       cfg.password,
    lowercase_keys: false,
    pageSize:       4096,
    charset:        "ISO8859_1", // Latin-1 — evita substituição de acentos por ?
  } as Firebird.Options;

  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) return reject(err);
      db.query(sql, params, (qErr, result) => {
        db.detach();
        if (qErr) return reject(qErr);
        resolve((result ?? []) as T[]);
      });
    });
  });
}

// Compatibilidade: usa a config salva automaticamente
export async function fbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const cfg = await getFbConfig();
  if (!cfg) throw new Error("Firebird não configurado. Acesse Financeiro → Configurações.");
  return fbQueryWithConfig<T>(cfg, sql, params);
}
