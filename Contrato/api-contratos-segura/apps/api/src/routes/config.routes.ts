import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../utils/auth-guard.js";
import {
  getFbConfig, saveFbConfig, fbQueryWithConfig, fbConfigSource,
  resolveDatabasePath, FbPathError, findSimilarFdbFiles,
} from "../lib/firebird.js";
import { loadFinanceiroFields } from "../lib/firebird-fields.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../env.js";
import fs from "node:fs";
import path from "node:path";

const firebirdConfigSchema = z.object({
  host:         z.string().min(1).optional(),
  port:         z.coerce.number().int().positive().optional(),
  database:     z.string().min(1).optional(),
  user:         z.string().min(1).optional(),
  password:     z.string().optional(),
  search:       z.string().optional(),
  // mapeamentos da tabela financeira
  tabelaFinanceiro:   z.string().optional(),
  campoCliente:       z.string().optional(),
  campoVencimento:    z.string().optional(),
  campoDtLiquidacao:  z.string().optional(),
  campoVlLiquidado:   z.string().optional(),
});

async function resolveFbConfigFromBody(body: z.infer<typeof firebirdConfigSchema>) {
  const saved = await getFbConfig();
  return {
    host:     body.host     ?? saved?.host     ?? "localhost",
    port:     body.port     ?? saved?.port     ?? 3050,
    database: body.database ?? saved?.database ?? "",
    user:     body.user     ?? saved?.user     ?? "SYSDBA",
    password: body.password ? body.password : (saved?.password ?? ""),
  };
}

function replyPathError(reply: FastifyReply, e: unknown, prefix = "") {
  const msg = e instanceof Error ? e.message : String(e);
  const suggestions = e instanceof FbPathError ? e.suggestions : [];
  return reply.status(400).send({
    ok: false,
    message: prefix ? `${prefix}${msg}` : msg,
    suggestions,
  });
}

async function queryClientesPreview(
  cfg: Awaited<ReturnType<typeof resolveFbConfigFromBody>>,
  search?: string,
) {
  const resolved = resolveDatabasePath(cfg.database);
  const activeCfg = { ...cfg, database: resolved.path };
  const term = search?.trim().toUpperCase();
  const sql = term
    ? `
      SELECT FIRST 100
        cl.CD_CLIENTE,
        cl.NM_RAZ_SOC_CLIENTE AS CLIENTE,
        cl.CD_CGC_CLIENTE       AS CNPJ
      FROM CLIENTE cl
      WHERE UPPER(cl.NM_RAZ_SOC_CLIENTE) CONTAINING ?
         OR cl.CD_CGC_CLIENTE CONTAINING ?
      ORDER BY cl.NM_RAZ_SOC_CLIENTE
    `
    : `
      SELECT FIRST 100
        cl.CD_CLIENTE,
        cl.NM_RAZ_SOC_CLIENTE AS CLIENTE,
        cl.CD_CGC_CLIENTE       AS CNPJ
      FROM CLIENTE cl
      ORDER BY cl.NM_RAZ_SOC_CLIENTE
    `;
  const params = term ? [term, term] : [];
  const countSql = term
    ? `
      SELECT COUNT(*) AS TOTAL
      FROM CLIENTE cl
      WHERE UPPER(cl.NM_RAZ_SOC_CLIENTE) CONTAINING ?
         OR cl.CD_CGC_CLIENTE CONTAINING ?
    `
    : `SELECT COUNT(*) AS TOTAL FROM CLIENTE`;

  const [rows, countRows] = await Promise.all([
    fbQueryWithConfig<{ CD_CLIENTE: number; CLIENTE: string; CNPJ: string | null }>(activeCfg, sql, params),
    fbQueryWithConfig<{ TOTAL: number }>(activeCfg, countSql, params),
  ]);

  return {
    total: Number(countRows[0]?.TOTAL ?? 0),
    items: rows.map((r) => ({
      cdCliente: Number(r.CD_CLIENTE),
      cliente:   r.CLIENTE?.trim() ?? "—",
      cnpj:      r.CNPJ?.trim() ?? "",
    })),
  };
}

export async function configRoutes(app: FastifyInstance) {

  // ── Sugestões de .fdb quando o caminho informado não existe ────────────────
  app.get<{ Querystring: { database?: string } }>(
    "/config/firebird/sugestoes",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const database = req.query.database?.trim();
      if (!database) {
        return reply.send({ suggestions: [] });
      }
      return reply.send({ suggestions: findSimilarFdbFiles(database) });
    },
  );

  // ── Retorna config atual (senha mascarada) ─────────────────────────────────
  app.get("/config/firebird", { preHandler: [requireAuth] }, async (_req, reply) => {
    const cfg = await getFbConfig();

    // Lê também os mapeamentos extras
    const rows = await prisma.systemConfig.findMany({
      where: { key: { startsWith: "firebird." } },
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const source = fbConfigSource(map);

    return reply.send({
      host:               cfg?.host     ?? "localhost",
      port:               cfg?.port     ?? 3050,
      database:           cfg?.database ?? "",
      user:               cfg?.user     ?? "SYSDBA",
      passwordSet:        !!map["firebird.password"] || !!env.FB_PASSWORD,
      source,
      // mapeamentos
      tabelaFinanceiro:   map["firebird.tabelaFinanceiro"]   ?? "CONTAS_PAGAR_RECEBER",
      campoCliente:       map["firebird.campoCliente"]       ?? "CD_CLIENTE",
      campoVencimento:    map["firebird.campoVencimento"]    ?? "DT_VENCIMENTO_PAG_REC",
      campoDtLiquidacao:  map["firebird.campoDtLiquidacao"]  ?? "DT_ULTIMA_LIQUIDACAO",
      campoVlLiquidado:   map["firebird.campoVlLiquidado"]  ?? "VL_TOTAL_LIQUIDADO",
      connected:          !!cfg,
    });
  });

  // ── Salva config ────────────────────────────────────────────────────────────
  app.patch("/config/firebird", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = firebirdConfigSchema.parse(req.body);
    const current = await getFbConfig();

    if (!body.database && !current?.database) {
      return reply.status(400).send({ message: "Informe o caminho do banco (.fdb) antes de salvar." });
    }

    try {
      await saveFbConfig({
        host:     body.host     ?? current?.host,
        port:     body.port     ?? current?.port,
        database: body.database ?? current?.database,
        user:     body.user     ?? current?.user,
        ...(body.password ? { password: body.password } : {}),
      });
    } catch (e: unknown) {
      return replyPathError(reply, e);
    }

    const savedCfg = await getFbConfig();
    const mapRows = await prisma.systemConfig.findMany({
      where: { key: { startsWith: "firebird." } },
    });
    const mapBefore = Object.fromEntries(mapRows.map((r) => [r.key, r.value]));

    // Detecta campos reais da tabela financeira neste banco
    let detectedFields: Awaited<ReturnType<typeof loadFinanceiroFields>> | null = null;
    if (savedCfg) {
      try {
        detectedFields = await loadFinanceiroFields(savedCfg, {
          ...mapBefore,
          tabelaFinanceiro: body.tabelaFinanceiro ?? mapBefore["firebird.tabelaFinanceiro"],
          campoCliente: body.campoCliente ?? mapBefore["firebird.campoCliente"],
          campoVencimento: body.campoVencimento ?? mapBefore["firebird.campoVencimento"],
          campoDtLiquidacao: body.campoDtLiquidacao ?? mapBefore["firebird.campoDtLiquidacao"],
          campoVlLiquidado: body.campoVlLiquidado ?? mapBefore["firebird.campoVlLiquidado"],
        });
      } catch {
        detectedFields = null;
      }
    }

    const extras: Record<string, string> = detectedFields
      ? {
          "firebird.tabelaFinanceiro":  detectedFields.tabelaFinanceiro,
          "firebird.campoCliente":      detectedFields.campoCliente,
          "firebird.campoVencimento":   detectedFields.campoVencimento,
          "firebird.campoDtLiquidacao": detectedFields.campoDtLiquidacao,
          "firebird.campoVlLiquidado":  detectedFields.campoVlLiquidado,
        }
      : {
          ...(body.tabelaFinanceiro ? { "firebird.tabelaFinanceiro": body.tabelaFinanceiro } : {}),
          ...(body.campoCliente ? { "firebird.campoCliente": body.campoCliente } : {}),
          ...(body.campoVencimento ? { "firebird.campoVencimento": body.campoVencimento } : {}),
          ...(body.campoDtLiquidacao ? { "firebird.campoDtLiquidacao": body.campoDtLiquidacao } : {}),
          ...(body.campoVlLiquidado ? { "firebird.campoVlLiquidado": body.campoVlLiquidado } : {}),
        };

    for (const [key, value] of Object.entries(extras)) {
      await prisma.systemConfig.upsert({
        where:  { key },
        create: { key, value },
        update: { value },
      });
    }

    const saved = savedCfg;
    const mapAfter = Object.fromEntries(
      (await prisma.systemConfig.findMany({ where: { key: { startsWith: "firebird." } } }))
        .map((r) => [r.key, r.value]),
    );

    return reply.send({
      ok: true,
      message: "Configuração salva e aplicada na página Financeiro.",
      database: saved?.database,
      source: fbConfigSource(mapAfter),
    });
  });

  // ── Testa conexão com a config fornecida ────────────────────────────────────
  app.post("/config/firebird/test", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = firebirdConfigSchema.parse(req.body);

    try {
      const testCfg = await resolveFbConfigFromBody(body);

      if (!testCfg.database) {
        return reply.status(400).send({ ok: false, message: "Caminho do banco não informado." });
      }

      const resolved = resolveDatabasePath(testCfg.database);
      testCfg.database = resolved.path;
      await fbQueryWithConfig(testCfg, "SELECT 1 FROM RDB$DATABASE");
      const message = resolved.corrected
        ? `Conexão OK. Caminho ajustado para: ${resolved.path}`
        : "Conexão estabelecida com sucesso!";
      return reply.send({ ok: true, message, database: resolved.path, corrected: resolved.corrected });
    } catch (e: unknown) {
      return replyPathError(reply, e);
    }
  });

  // ── Preview de clientes (conexão salva ou informada no body) ───────────────
  app.get<{ Querystring: { search?: string } }>(
    "/config/firebird/clientes",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const cfg = await getFbConfig();
      if (!cfg) return reply.status(503).send({ message: "Firebird não configurado." });

      try {
        return reply.send(await queryClientesPreview(cfg, req.query.search));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ message: `Erro ao listar clientes: ${msg}` });
      }
    },
  );

  app.post("/config/firebird/clientes/preview", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = firebirdConfigSchema.parse(req.body);

    try {
      const testCfg = await resolveFbConfigFromBody(body);

      if (!testCfg.database) {
        return reply.status(400).send({ message: "Caminho do banco não informado." });
      }

      const resolved = resolveDatabasePath(testCfg.database);
      testCfg.database = resolved.path;
      return reply.send(await queryClientesPreview(testCfg, body.search));
    } catch (e: unknown) {
      return replyPathError(reply, e);
    }
  });

  // ── Browser de arquivos do servidor ──────────────────────────────────────
  app.get<{ Querystring: { path?: string } }>(
    "/config/browse",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const reqPath = req.query.path;

      // Se não informado, retorna as raízes de disco (Windows)
      if (!reqPath) {
        const drives: { name: string; fullPath: string; type: "drive" }[] = [];
        for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
          const drivePath = `${letter}:\\`;
          try {
            fs.accessSync(drivePath);
            drives.push({ name: `${letter}:`, fullPath: drivePath, type: "drive" });
          } catch { /* não existe */ }
        }
        return reply.send({ current: "", parent: null, items: drives });
      }

      const absPath = path.resolve(reqPath);

      try {
        const stat = fs.statSync(absPath);
        if (!stat.isDirectory()) {
          return reply.status(400).send({ message: "Caminho não é um diretório." });
        }

        const entries = fs.readdirSync(absPath, { withFileTypes: true });
        const items = entries
          .filter((e) => {
            if (e.isDirectory()) return true;
            if (e.isFile() && e.name.toLowerCase().endsWith(".fdb")) return true;
            return false;
          })
          .map((e) => ({
            name: e.name,
            fullPath: path.join(absPath, e.name),
            type: e.isDirectory() ? "dir" : "fdb",
          }))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name);
          });

        const parentPath = path.dirname(absPath);
        const parent = parentPath !== absPath ? parentPath : null;

        return reply.send({ current: absPath, parent, items });
      } catch (e: unknown) {
        return reply.status(400).send({ message: e instanceof Error ? e.message : String(e) });
      }
    }
  );

  async function listarCamposTabela(
    cfg: NonNullable<Awaited<ReturnType<typeof getFbConfig>>>,
    tabela: string,
  ) {
    const resolved = resolveDatabasePath(cfg.database);
    const activeCfg = { ...cfg, database: resolved.path };
    const sql = `
      SELECT TRIM(r.RDB$FIELD_NAME) AS CAMPO
      FROM RDB$RELATION_FIELDS r
      WHERE r.RDB$RELATION_NAME = ?
      ORDER BY r.RDB$FIELD_POSITION
    `;
    const rows = await fbQueryWithConfig<{ CAMPO: string }>(activeCfg, sql, [tabela.toUpperCase()]);
    return rows.map((r) => r.CAMPO.trim());
  }

  // ── Lista campos de uma tabela (conexão salva) ─────────────────────────────
  app.get<{ Params: { tabela: string } }>(
    "/config/firebird/campos/:tabela",
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const cfg = await getFbConfig();
      if (!cfg) return reply.status(503).send({ message: "Firebird não configurado." });

      try {
        return reply.send(await listarCamposTabela(cfg, req.params.tabela));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return reply.status(400).send({ message: msg });
      }
    },
  );

  // ── Lista campos usando a conexão informada no body (antes de salvar) ──────
  app.post("/config/firebird/campos", { preHandler: [requireAuth] }, async (req, reply) => {
    const body = firebirdConfigSchema.parse(req.body);

    try {
      const testCfg = await resolveFbConfigFromBody(body);
      const tabela = body.tabelaFinanceiro;

      if (!testCfg.database) {
        return reply.status(400).send({ message: "Caminho do banco não informado." });
      }
      if (!tabela) {
        return reply.status(400).send({ message: "Informe a tabela de parcelas." });
      }

      return reply.send(await listarCamposTabela(testCfg, tabela));
    } catch (e: unknown) {
      return replyPathError(reply, e);
    }
  });
}
