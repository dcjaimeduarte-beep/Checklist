import type { FastifyInstance } from "fastify";
import { requireAuth } from "../utils/auth-guard.js";
import { fbQuery, getFbConfig, fbQueryWithConfig, fbConfigSource, resolveDatabasePath, isLocalHost } from "../lib/firebird.js";
import { loadFinanceiroFields, type FinanceiroFieldMap } from "../lib/firebird-fields.js";
import { prisma } from "../lib/prisma.js";

async function persistFinanceiroFields(fields: FinanceiroFieldMap) {
  const entries: Record<string, string> = {
    "firebird.tabelaFinanceiro":  fields.tabelaFinanceiro,
    "firebird.campoCliente":      fields.campoCliente,
    "firebird.campoVencimento":   fields.campoVencimento,
    "firebird.campoDtLiquidacao": fields.campoDtLiquidacao,
    "firebird.campoVlLiquidado":  fields.campoVlLiquidado,
  };
  for (const [key, value] of Object.entries(entries)) {
    await prisma.systemConfig.upsert({
      where:  { key },
      create: { key, value },
      update: { value },
    });
  }
}

export async function firebirdRoutes(app: FastifyInstance) {

  // ── Teste de conexão ───────────────────────────────────────────────────────
  app.get("/firebird/status", { preHandler: [requireAuth] }, async (_req, reply) => {
    const cfg = await getFbConfig();
    if (!cfg) {
      return reply.status(503).send({ connected: false, message: "Firebird não configurado. Acesse Financeiro → Configurações." });
    }
    const mapRows = await prisma.systemConfig.findMany({
      where: { key: { startsWith: "firebird." } },
    });
    const map = Object.fromEntries(mapRows.map((r) => [r.key, r.value]));

    try {
      // Para host remoto o caminho é resolvido no servidor Firebird, não localmente
      let activeCfg = cfg;
      let dbPath    = cfg.database;
      let corrected = false;

      if (isLocalHost(cfg.host)) {
        const resolved = resolveDatabasePath(cfg.database);
        activeCfg = { ...cfg, database: resolved.path };
        dbPath    = resolved.path;
        corrected = resolved.corrected;
      }

      await fbQueryWithConfig(activeCfg, "SELECT 1 FROM RDB$DATABASE");
      return reply.send({
        connected: true,
        database: dbPath,
        source: fbConfigSource(map),
        corrected,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(503).send({ connected: false, message: msg, database: cfg.database });
    }
  });

  // ── Listar tabelas ─────────────────────────────────────────────────────────
  app.get<{ Querystring: { search?: string } }>("/firebird/tabelas", { preHandler: [requireAuth] }, async (req, reply) => {
    const search = req.query.search?.toUpperCase() ?? "";
    const sql = `
      SELECT TRIM(RDB$RELATION_NAME) AS TABELA,
             COALESCE(RDB$DESCRIPTION, '') AS DESCRICAO
      FROM RDB$RELATIONS
      WHERE RDB$SYSTEM_FLAG = 0
        AND RDB$VIEW_BLR IS NULL
        ${search ? "AND RDB$RELATION_NAME CONTAINING ?" : ""}
      ORDER BY RDB$RELATION_NAME
    `;
    const params = search ? [search] : [];
    const rows = await fbQuery<{ TABELA: string; DESCRICAO: string }>(sql, params);
    return reply.send(rows.map(r => r.TABELA));
  });

  // ── Campos de uma tabela ───────────────────────────────────────────────────
  app.get<{ Params: { tabela: string } }>("/firebird/tabelas/:tabela/campos", { preHandler: [requireAuth] }, async (req, reply) => {
    const tabela = req.params.tabela.toUpperCase();
    const sql = `
      SELECT
        TRIM(r.RDB$FIELD_NAME)      AS CAMPO,
        TRIM(t.RDB$TYPE_NAME)       AS TIPO,
        f.RDB$FIELD_LENGTH          AS TAMANHO,
        f.RDB$FIELD_PRECISION       AS PRECISAO,
        f.RDB$FIELD_SCALE           AS ESCALA,
        r.RDB$NULL_FLAG             AS NULO
      FROM RDB$RELATION_FIELDS r
      JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = r.RDB$FIELD_SOURCE
      LEFT JOIN RDB$TYPES t ON t.RDB$TYPE = f.RDB$FIELD_TYPE AND t.RDB$FIELD_NAME = 'RDB$FIELD_TYPE'
      WHERE r.RDB$RELATION_NAME = ?
      ORDER BY r.RDB$FIELD_POSITION
    `;
    const rows = await fbQuery<{
      CAMPO: string; TIPO: string; TAMANHO: number;
      PRECISAO: number; ESCALA: number; NULO: number;
    }>(sql, [tabela]);
    return reply.send(rows);
  });

  // ── Preview de dados de uma tabela (primeiras 50 linhas) ──────────────────
  app.get<{ Params: { tabela: string }; Querystring: { limit?: string } }>(
    "/firebird/tabelas/:tabela/preview",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const tabela = req.params.tabela.toUpperCase();
      const limit  = Math.min(parseInt(req.query.limit ?? "50", 10), 200);
      try {
        const rows = await fbQuery(`SELECT FIRST ${limit} * FROM ${tabela}`);
        return reply.send(rows);
      } catch (e: unknown) {
        return reply.status(400).send({ message: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  // ── Parcelas vencendo (próximos N dias ou intervalo de datas) ─────────────
  app.get<{ Querystring: { dias?: string; dataInicio?: string; dataFim?: string } }>(
    "/firebird/parcelas/alertas",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const cfg = await getFbConfig();
      if (!cfg) return reply.status(503).send({ message: "Firebird não configurado. Acesse Financeiro → Configurações." });

      // Lê mapeamentos da config
      const cfgRows = await prisma.contractTemplate.findFirst().then(() =>
        prisma.systemConfig.findMany({ where: { key: { startsWith: "firebird." } } })
      );
      const map = Object.fromEntries(cfgRows.map((r) => [r.key, r.value]));

      const parseIsoDate = (s?: string) => {
        if (!s?.trim()) return null;
        const t = s.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
        if (isNaN(new Date(`${t}T12:00:00`).getTime())) return null;
        return t;
      };

      const dataInicio = parseIsoDate(req.query.dataInicio);
      const dataFim    = parseIsoDate(req.query.dataFim);
      const dias       = Math.min(Math.max(parseInt(req.query.dias ?? "60", 10) || 60, 1), 3650);

      let fields: FinanceiroFieldMap;
      try {
        fields = await loadFinanceiroFields(cfg, map);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ message: msg });
      }

      if (fields.autoCorrected) {
        await persistFinanceiroFields(fields);
      }

      const {
        tabelaFinanceiro: tabela,
        campoCliente,
        campoVencimento,
        campoDtLiquidacao: campoDtLiq,
        campoVlLiquidado: campoVlLiq,
      } = fields;

      let aviso = fields.autoCorrected
        ? `Mapeamento ajustado automaticamente (cliente: ${campoCliente}).`
        : undefined;

      if (dataInicio && dataFim && dataInicio > dataFim) {
        return reply.status(400).send({ message: "Data inicial não pode ser posterior à data final." });
      }

      const vencParams: unknown[] = [];
      let vencClause: string;
      let periodoTipo: "dias" | "intervalo" | "ate" | "desde";

      if (dataInicio && dataFim) {
        vencClause = `AND p.${campoVencimento} >= ? AND p.${campoVencimento} <= ?`;
        vencParams.push(dataInicio, dataFim);
        periodoTipo = "intervalo";
      } else if (dataInicio) {
        vencClause = `AND p.${campoVencimento} >= ?`;
        vencParams.push(dataInicio);
        periodoTipo = "desde";
      } else if (dataFim) {
        vencClause = `AND p.${campoVencimento} <= ?`;
        vencParams.push(dataFim);
        periodoTipo = "ate";
      } else {
        vencClause = `AND p.${campoVencimento} <= (CAST('TODAY' AS DATE) + ${dias})`;
        periodoTipo = "dias";
      }

      const whereBase = `WHERE p.${campoDtLiq} IS NULL ${vencClause}`;

      // Tenta primeiro com JOIN na tabela CLIENTE para pegar nome/CNPJ
      // Se falhar (campo cliente inválido), cai na versão sem JOIN
      const sqlComJoin = `
        SELECT FIRST 500
          p.${campoCliente}             AS CD_CLIENTE_PAG,
          cl.NM_RAZ_SOC_CLIENTE        AS CLIENTE,
          cl.CD_CGC_CLIENTE            AS CNPJ,
          p.${campoVencimento}         AS VENCIMENTO,
          p.${campoVlLiq}              AS VL_LIQUIDADO,
          p.${campoDtLiq}              AS DT_LIQUIDACAO,
          (p.${campoVencimento} - CAST('TODAY' AS DATE)) AS DIAS_VENCER
        FROM ${tabela} p
        LEFT JOIN CLIENTE cl ON cl.CD_CLIENTE = p.${campoCliente}
        ${whereBase}
        ORDER BY p.${campoVencimento} ASC
      `;

      const sqlSemJoin = `
        SELECT FIRST 500
          p.${campoCliente}             AS CD_CLIENTE_PAG,
          p.${campoVencimento}         AS VENCIMENTO,
          p.${campoVlLiq}              AS VL_LIQUIDADO,
          p.${campoDtLiq}              AS DT_LIQUIDACAO,
          (p.${campoVencimento} - CAST('TODAY' AS DATE)) AS DIAS_VENCER
        FROM ${tabela} p
        ${whereBase}
        ORDER BY p.${campoVencimento} ASC
      `;

      try {
        let rows: Record<string, unknown>[];
        let usouJoin = true;

        try {
          rows = await fbQueryWithConfig(cfg, sqlComJoin, vencParams);
        } catch (joinErr) {
          usouJoin = false;
          rows = await fbQueryWithConfig(cfg, sqlSemJoin, vencParams) as Record<string, unknown>[];
          const msg = joinErr instanceof Error ? joinErr.message : String(joinErr);
          aviso = aviso
            ? `${aviso} Nomes sem JOIN (${msg}).`
            : `Parcelas carregadas; nomes de clientes indisponíveis (${msg}).`;
        }

        const typedRows = rows as {
          CD_CLIENTE_PAG?: number;
          CLIENTE?: string;
          CNPJ?: string;
          VENCIMENTO: string;
          VL_LIQUIDADO: number;
          DT_LIQUIDACAO: string | null;
          DIAS_VENCER: number;
        }[];

        // Agrupa por cliente
        const byClient = new Map<number, {
          cdCliente: number;
          cliente: string;
          cnpj: string;
          parcelas: { vencimento: string; diasVencer: number }[];
          totalVencer: number;
          vencidas: number;
        }>();

        for (const r of typedRows) {
          const cd = Number(r.CD_CLIENTE_PAG ?? 0);
          if (!byClient.has(cd)) {
            byClient.set(cd, {
              cdCliente: cd,
              cliente: r.CLIENTE ?? "—",
              cnpj: r.CNPJ ?? "",
              parcelas: [],
              totalVencer: 0,
              vencidas: 0,
            });
          }
          const entry = byClient.get(cd)!;
          const diasVencer = Number(r.DIAS_VENCER ?? 0);
          entry.parcelas.push({ vencimento: String(r.VENCIMENTO), diasVencer });
          if (diasVencer < 0) entry.vencidas++;
          entry.totalVencer++;
        }

        const result = Array.from(byClient.values())
          .sort((a, b) => a.vencidas !== b.vencidas
            ? b.vencidas - a.vencidas
            : b.totalVencer - a.totalVencer);

        if (!usouJoin && result.some((c) => !c.cliente || c.cliente === "—")) {
          aviso = aviso ?? `Clientes sem nome — confira o mapeamento do campo "${campoCliente}" em Configurações.`;
        }

        return reply.send({
          total: rows.length,
          clientes: result.length,
          items: result,
          database: cfg.database,
          source: fbConfigSource(map),
          usouJoin,
          aviso,
          periodo: {
            tipo: periodoTipo,
            dias: periodoTipo === "dias" ? dias : undefined,
            dataInicio: dataInicio ?? undefined,
            dataFim: dataFim ?? undefined,
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ message: `Erro na query Firebird: ${msg}` });
      }
    }
  );

  // ── Parcelas de um cliente específico ─────────────────────────────────────
  app.get<{
    Params: { cdCliente: string };
    Querystring: { campoCliente?: string; dataInicio?: string; dataFim?: string };
  }>(
    "/firebird/parcelas/cliente/:cdCliente",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const cfg = await getFbConfig();
      if (!cfg) return reply.status(503).send({ message: "Firebird não configurado." });

      const mapRows = await prisma.systemConfig.findMany({
        where: { key: { startsWith: "firebird." } },
      });
      const map = Object.fromEntries(mapRows.map((r) => [r.key, r.value]));

      const { cdCliente } = req.params;
      const { dataInicio, dataFim } = req.query;

      let fields: FinanceiroFieldMap;
      try {
        fields = await loadFinanceiroFields(cfg, map);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ message: msg });
      }

      if (fields.autoCorrected) {
        await persistFinanceiroFields(fields);
      }

      const {
        tabelaFinanceiro: tabela,
        campoCliente: campoClienteDefault,
        campoVencimento,
        campoDtLiquidacao: campoDtLiq,
        campoVlLiquidado: campoVlLiq,
      } = fields;
      const campoCliente = req.query.campoCliente ?? campoClienteDefault;

      const dateParams: unknown[] = [];
      let dateClause = "";
      if (dataInicio?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateClause += ` AND p.${campoVencimento} >= ?`;
        dateParams.push(dataInicio);
      }
      if (dataFim?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateClause += ` AND p.${campoVencimento} <= ?`;
        dateParams.push(dataFim);
      }

      const sql = `
        SELECT FIRST 500
          p.${campoVencimento}  AS VENCIMENTO,
          p.${campoDtLiq}       AS DT_LIQUIDACAO,
          p.${campoVlLiq}       AS VL_LIQUIDADO,
          (p.${campoVencimento} - CAST('TODAY' AS DATE)) AS DIAS_VENCER
        FROM ${tabela} p
        WHERE p.${campoCliente} = ?
          ${dateClause}
        ORDER BY p.${campoVencimento} DESC
      `;
      try {
        const rows = await fbQueryWithConfig(cfg, sql, [parseInt(cdCliente, 10), ...dateParams]);
        return reply.send(rows);
      } catch (e: unknown) {
        return reply.status(500).send({ message: e instanceof Error ? e.message : String(e) });
      }
    }
  );
}
