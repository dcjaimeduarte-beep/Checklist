import type { FbConfig } from "./firebird.js";
import { fbQueryWithConfig, resolveDbPathIfLocal } from "./firebird.js";

export type FinanceiroFieldMap = {
  tabelaFinanceiro: string;
  campoCliente: string;
  campoVencimento: string;
  campoDtLiquidacao: string;
  campoVlLiquidado: string;
  autoCorrected: boolean;
};

const CANDIDATE_CLIENTE = [
  "CD_CLIENTE_PAG_REC", "COD_CLIENTE_PAG_REC",
  "CD_CLIENTE", "COD_CLIENTE", "ID_CLIENTE", "CLIENTE_ID", "CODIGO_CLIENTE",
  "CD_PESSOA", "COD_PESSOA", "ID_PESSOA", "CD_EMITENTE", "COD_EMITENTE",
  "CD_FORNECEDOR_PAG_REC", "CD_FORNECEDOR", "COD_FORNECEDOR",
];

const CANDIDATE_VENCIMENTO = [
  "DT_VENCIMENTO_PAG_REC", "DT_VENCIMENTO", "DATA_VENCIMENTO", "DT_VENC", "VENCIMENTO",
];

const CANDIDATE_DT_LIQ = [
  "DT_ULTIMA_LIQUIDACAO", "DT_LIQUIDACAO", "DATA_PAGAMENTO", "DT_PAGAMENTO", "DT_BAIXA",
];

const CANDIDATE_VL_LIQ = [
  "VL_TOTAL_LIQUIDADO", "VL_LIQUIDADO", "VALOR_LIQUIDADO", "VL_PAGO", "VALOR_PAGO",
];

function norm(s: string) {
  return s.trim().toUpperCase();
}

function hasColumn(campos: string[], name: string) {
  return campos.some((c) => norm(c) === norm(name));
}

function pickClienteColumn(campos: string[], preferred?: string): string | null {
  const clienteCols = campos.filter((c) => /CLIENTE/i.test(c) && !/FORNEC/i.test(c));
  if (clienteCols.length === 1) return clienteCols[0] ?? null;
  if (clienteCols.length > 1) {
    for (const c of CANDIDATE_CLIENTE) {
      const hit = clienteCols.find((x) => norm(x) === c);
      if (hit) return hit;
    }
    return clienteCols[0] ?? null;
  }
  return pickColumn(campos, preferred, CANDIDATE_CLIENTE, /CLIENTE|PESSOA|FORNEC|EMITENT/i);
}

function pickColumn(
  campos: string[],
  preferred: string | undefined,
  candidates: string[],
  pattern?: RegExp,
): string | null {
  if (preferred && hasColumn(campos, preferred)) {
    const resolved = campos.find((c) => norm(c) === norm(preferred))!;
    if (/FORNEC/i.test(resolved)) {
      const better = pickColumn(campos, undefined, candidates, pattern);
      if (better && /CLIENTE/i.test(better) && !/FORNEC/i.test(better)) return better;
    }
    return resolved;
  }
  for (const c of candidates) {
    const hit = campos.find((x) => norm(x) === c);
    if (hit) return hit;
  }
  if (pattern) {
    const hits = campos.filter((c) => pattern.test(c));
    const cliente = hits.find((c) => /CLIENTE/i.test(c) && !/FORNEC/i.test(c));
    if (cliente) return cliente;
    return hits[0] ?? null;
  }
  return null;
}

export async function listTableColumns(cfg: FbConfig, tabela: string): Promise<string[]> {
  const { cfg: activeCfg } = resolveDbPathIfLocal(cfg);
  const sql = `
    SELECT TRIM(r.RDB$FIELD_NAME) AS CAMPO
    FROM RDB$RELATION_FIELDS r
    WHERE r.RDB$RELATION_NAME = ?
    ORDER BY r.RDB$FIELD_POSITION
  `;
  const rows = await fbQueryWithConfig<{ CAMPO: string }>(activeCfg, sql, [tabela.toUpperCase()]);
  return rows.map((r) => r.CAMPO.trim()).filter(Boolean);
}

export function resolveFinanceiroFields(
  campos: string[],
  saved: Partial<FinanceiroFieldMap>,
): FinanceiroFieldMap {
  const tabelaFinanceiro = saved.tabelaFinanceiro ?? "CONTAS_PAGAR_RECEBER";

  const campoCliente = pickClienteColumn(campos, saved.campoCliente);
  const campoVencimento = pickColumn(
    campos,
    saved.campoVencimento,
    CANDIDATE_VENCIMENTO,
    /VENC/i,
  );
  const campoDtLiquidacao = pickColumn(
    campos,
    saved.campoDtLiquidacao,
    CANDIDATE_DT_LIQ,
    /LIQUID|PAG|BAIXA/i,
  );
  const campoVlLiquidado = pickColumn(
    campos,
    saved.campoVlLiquidado,
    CANDIDATE_VL_LIQ,
    /LIQUID|VL_|VALOR/i,
  );

  const missing: string[] = [];
  if (!campoCliente) missing.push("cliente");
  if (!campoVencimento) missing.push("vencimento");
  if (!campoDtLiquidacao) missing.push("data de liquidação");
  if (!campoVlLiquidado) missing.push("valor liquidado");

  if (missing.length) {
    throw new Error(
      `Não foi possível mapear: ${missing.join(", ")}. ` +
      `Campos na tabela: ${campos.slice(0, 20).join(", ")}${campos.length > 20 ? "…" : ""}. ` +
      `Ajuste em Financeiro → Configurações.`,
    );
  }

  const resolved = {
    tabelaFinanceiro,
    campoCliente: campoCliente!,
    campoVencimento: campoVencimento!,
    campoDtLiquidacao: campoDtLiquidacao!,
    campoVlLiquidado: campoVlLiquidado!,
  };

  const autoCorrected =
    (saved.campoCliente ?? "CD_CLIENTE") !== resolved.campoCliente ||
    (saved.campoVencimento ?? "DT_VENCIMENTO_PAG_REC") !== resolved.campoVencimento ||
    (saved.campoDtLiquidacao ?? "DT_ULTIMA_LIQUIDACAO") !== resolved.campoDtLiquidacao ||
    (saved.campoVlLiquidado ?? "VL_TOTAL_LIQUIDADO") !== resolved.campoVlLiquidado;

  return { ...resolved, autoCorrected };
}

export async function loadFinanceiroFields(
  cfg: FbConfig,
  map: Record<string, string | undefined>,
): Promise<FinanceiroFieldMap> {
  const tabela = map["firebird.tabelaFinanceiro"] ?? "CONTAS_PAGAR_RECEBER";
  const campos = await listTableColumns(cfg, tabela);
  return resolveFinanceiroFields(campos, {
    tabelaFinanceiro: tabela,
    campoCliente: map["firebird.campoCliente"],
    campoVencimento: map["firebird.campoVencimento"],
    campoDtLiquidacao: map["firebird.campoDtLiquidacao"],
    campoVlLiquidado: map["firebird.campoVlLiquidado"],
  });
}
