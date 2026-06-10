import { prisma } from "./prisma.js";
import { getFbConfig, fbQueryWithConfig, isLocalHost, resolveDatabasePath } from "./firebird.js";

type FirebirdCliente = {
  CD_CLIENTE: number;
  NM_RAZ_SOC_CLIENTE: string;
  NM_FANTASIA_CLIENTE?: string;
  CD_CGC_CLIENTE?: string;
  CD_INSCR_EST_CLIENTE?: string;
  DS_EMAIL_CLIENTE?: string;
  NM_CONTATO_CLIENTE?: string;
  CD_FONE_CLIENTE?: string;
  CD_CELULAR_CLIENTE?: string;
  DS_END_COM_CLIENTE?: string;
  DS_NUMERO?: string;
  DS_COMPLEMENTO?: string;
  CD_CEP?: string;
  CD_ESTADO?: string;
  DS_TEXTO_CIDADE?: string;
  DS_BAIRRO?: string;
};

export type SyncResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  ranAt: string;
  durationMs: number;
  error?: string;
};

function cleanStr(v: unknown): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  return s && s !== "0" ? s : undefined;
}

function formatCep(v: unknown): string | undefined {
  const raw = cleanStr(v);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return raw;
}

export async function syncClientsFromFirebird(options?: { updateExisting?: boolean }): Promise<SyncResult> {
  const updateExisting = options?.updateExisting ?? false;
  const ranAt = new Date().toISOString();
  const start = Date.now();

  const cfg = await getFbConfig();
  if (!cfg) {
    return { total: 0, created: 0, updated: 0, skipped: 0, ranAt, durationMs: 0, error: "Firebird não configurado." };
  }

  let activeCfg = cfg;
  if (isLocalHost(cfg.host)) {
    try { activeCfg = { ...cfg, database: resolveDatabasePath(cfg.database).path }; } catch { /* usa path como está */ }
  }

  let rows: FirebirdCliente[];
  try {
    // Tenta com JOIN em BAIRRO e CIDADE para pegar nomes; cai no SELECT simples se falhar
    const sqlComJoin = `
      SELECT FIRST 5000
        c.CD_CLIENTE,
        TRIM(c.NM_RAZ_SOC_CLIENTE)   AS NM_RAZ_SOC_CLIENTE,
        TRIM(c.NM_FANTASIA_CLIENTE)   AS NM_FANTASIA_CLIENTE,
        TRIM(c.CD_CGC_CLIENTE)        AS CD_CGC_CLIENTE,
        TRIM(c.CD_INSCR_EST_CLIENTE)  AS CD_INSCR_EST_CLIENTE,
        TRIM(c.DS_EMAIL_CLIENTE)      AS DS_EMAIL_CLIENTE,
        TRIM(c.NM_CONTATO_CLIENTE)    AS NM_CONTATO_CLIENTE,
        TRIM(c.CD_FONE_CLIENTE)       AS CD_FONE_CLIENTE,
        TRIM(c.CD_CELULAR_CLIENTE)    AS CD_CELULAR_CLIENTE,
        TRIM(c.DS_END_COM_CLIENTE)    AS DS_END_COM_CLIENTE,
        TRIM(c.DS_NUMERO)             AS DS_NUMERO,
        TRIM(c.DS_COMPLEMENTO)        AS DS_COMPLEMENTO,
        TRIM(c.CD_CEP)                AS CD_CEP,
        TRIM(c.CD_ESTADO)             AS CD_ESTADO,
        COALESCE(TRIM(c.DS_TEXTO_CIDADE), TRIM(ci.DS_CIDADE)) AS DS_TEXTO_CIDADE,
        TRIM(b.DS_BAIRRO)             AS DS_BAIRRO
      FROM CLIENTE c
      LEFT JOIN BAIRRO b  ON b.CD_BAIRRO   = c.CD_BAIRRO
      LEFT JOIN CIDADE ci ON ci.CD_CIDADE  = c.CD_CIDADE
      WHERE c.NM_RAZ_SOC_CLIENTE IS NOT NULL
        AND c.NM_RAZ_SOC_CLIENTE <> 'CONSUMIDOR'
      ORDER BY c.CD_CLIENTE
    `;

    const sqlSemJoin = `
      SELECT FIRST 5000
        CD_CLIENTE,
        TRIM(NM_RAZ_SOC_CLIENTE)   AS NM_RAZ_SOC_CLIENTE,
        TRIM(NM_FANTASIA_CLIENTE)   AS NM_FANTASIA_CLIENTE,
        TRIM(CD_CGC_CLIENTE)        AS CD_CGC_CLIENTE,
        TRIM(CD_INSCR_EST_CLIENTE)  AS CD_INSCR_EST_CLIENTE,
        TRIM(DS_EMAIL_CLIENTE)      AS DS_EMAIL_CLIENTE,
        TRIM(NM_CONTATO_CLIENTE)    AS NM_CONTATO_CLIENTE,
        TRIM(CD_FONE_CLIENTE)       AS CD_FONE_CLIENTE,
        TRIM(CD_CELULAR_CLIENTE)    AS CD_CELULAR_CLIENTE,
        TRIM(DS_END_COM_CLIENTE)    AS DS_END_COM_CLIENTE,
        TRIM(DS_NUMERO)             AS DS_NUMERO,
        TRIM(DS_COMPLEMENTO)        AS DS_COMPLEMENTO,
        TRIM(CD_CEP)                AS CD_CEP,
        TRIM(CD_ESTADO)             AS CD_ESTADO,
        TRIM(DS_TEXTO_CIDADE)       AS DS_TEXTO_CIDADE
      FROM CLIENTE
      WHERE NM_RAZ_SOC_CLIENTE IS NOT NULL
        AND NM_RAZ_SOC_CLIENTE <> 'CONSUMIDOR'
      ORDER BY CD_CLIENTE
    `;

    try {
      rows = await fbQueryWithConfig<FirebirdCliente>(activeCfg, sqlComJoin);
    } catch {
      rows = await fbQueryWithConfig<FirebirdCliente>(activeCfg, sqlSemJoin);
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    const result: SyncResult = { total: 0, created: 0, updated: 0, skipped: 0, ranAt, durationMs: Date.now() - start, error };
    await persistResult(result);
    return result;
  }

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const razaoSocial = cleanStr(row.NM_RAZ_SOC_CLIENTE);
    if (!razaoSocial || razaoSocial.toUpperCase() === "CONSUMIDOR") { skipped++; continue; }

    const externalCode = Number(row.CD_CLIENTE);
    if (!externalCode) { skipped++; continue; }

    const data = {
      razaoSocial,
      nomeFantasia:      cleanStr(row.NM_FANTASIA_CLIENTE)  ?? null,
      cnpj:              cleanStr(row.CD_CGC_CLIENTE)       ?? null,
      inscricaoEstadual: cleanStr(row.CD_INSCR_EST_CLIENTE) ?? null,
      email:             cleanStr(row.DS_EMAIL_CLIENTE)     ?? null,
      contactName:       cleanStr(row.NM_CONTATO_CLIENTE)   ?? null,
      phone:             cleanStr(row.CD_FONE_CLIENTE) ?? cleanStr(row.CD_CELULAR_CLIENTE) ?? null,
      street:            cleanStr(row.DS_END_COM_CLIENTE)   ?? null,
      addressNumber:     cleanStr(row.DS_NUMERO)            ?? null,
      addressComplement: cleanStr(row.DS_COMPLEMENTO)       ?? null,
      zipCode:           formatCep(row.CD_CEP)               ?? null,
      state:             cleanStr(row.CD_ESTADO)            ?? null,
      city:              cleanStr(row.DS_TEXTO_CIDADE)      ?? null,
      neighborhood:      cleanStr(row.DS_BAIRRO)            ?? null,
    };

    try {
      const existing = await prisma.client.findUnique({ where: { externalCode } });
      if (existing) {
        if (updateExisting) {
          await prisma.client.update({ where: { externalCode }, data });
          updated++;
        } else {
          skipped++;
        }
      } else {
        await prisma.client.create({ data: { ...data, externalCode } });
        created++;
      }
    } catch {
      skipped++;
    }
  }

  const result: SyncResult = { total: rows.length, created, updated, skipped, ranAt, durationMs: Date.now() - start };
  await persistResult(result);
  return result;
}

async function persistResult(result: SyncResult) {
  await prisma.systemConfig.upsert({
    where:  { key: "client_sync.last_result" },
    create: { key: "client_sync.last_result", value: JSON.stringify(result) },
    update: { value: JSON.stringify(result) },
  });
}

export async function getLastSyncResult(): Promise<SyncResult | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key: "client_sync.last_result" } });
  if (!row) return null;
  try { return JSON.parse(row.value) as SyncResult; } catch { return null; }
}
