"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Save, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

type ContractTypeConfig = {
  type: string;
  displayName: string;
  clauseOverrides: Record<string, string>;
  updatedAt: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  SOLUTIO_ERP:  "#1B7A8C",
  GCONCILIADOR: "#7A5100",
  SOLUTIO_WEB:  "#0F7A6B",
};

const CLAUSE_HINT = "Cláusula 1 - OBJETO\nDescreva o objeto do contrato...";

export default function ContractTypesPage() {
  const [configs, setConfigs] = useState<ContractTypeConfig[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState("");

  useEffect(() => {
    apiFetch<ContractTypeConfig[]>("/contract-types")
      .then(setConfigs)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar."))
      .finally(() => setLoading(false));
  }, []);

  function updateConfig(type: string, updated: ContractTypeConfig) {
    setConfigs((prev) => prev.map((c) => (c.type === type ? updated : c)));
  }

  if (loading) return <p style={{ color: "var(--gray)" }}>Carregando...</p>;
  if (error) return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#C0392B" }}>
      <AlertTriangle size={16} /> {error}
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tipos de Contrato</h1>
          <p className="page-subtitle">Configure as cláusulas específicas de cada produto</p>
        </div>
      </div>

      <div style={{ background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.5rem" }}>
        <p style={{ fontSize: "0.875rem", color: "#7A5100", margin: 0 }}>
          O template base (Solutio ERP) é usado como referência. Para os demais tipos, cadastre apenas as cláusulas que <strong>diferem</strong> do base — as demais serão herdadas automaticamente.
          As cláusulas que mudam são: <strong>1, 2, 5 e 16</strong>.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {configs.map((cfg) => (
          <ContractTypeCard
            key={cfg.type}
            config={cfg}
            onSaved={updateConfig}
          />
        ))}
      </div>
    </div>
  );
}

function ContractTypeCard({
  config,
  onSaved,
}: {
  config: ContractTypeConfig;
  onSaved: (type: string, updated: ContractTypeConfig) => void;
}) {
  const [overrides, setOverrides] = useState<Record<string, string>>(config.clauseOverrides ?? {});
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");
  const [expanded,  setExpanded]  = useState(config.type !== "SOLUTIO_ERP");

  const color = TYPE_COLORS[config.type] ?? "#1B7A8C";
  const isSolutioErp = config.type === "SOLUTIO_ERP";
  const clauseKeys = Object.keys(overrides).sort((a, b) => Number(a) - Number(b));

  function addClause() {
    const num = prompt("Número da cláusula a sobrescrever (ex: 1, 5, 16):");
    if (!num || !/^\d+$/.test(num.trim())) return;
    const n = num.trim();
    if (overrides[n] !== undefined) return;
    setOverrides((prev) => ({ ...prev, [n]: "" }));
  }

  function removeClause(num: string) {
    setOverrides((prev) => {
      const copy = { ...prev };
      delete copy[num];
      return copy;
    });
  }

  function updateClause(num: string, text: string) {
    setOverrides((prev) => ({ ...prev, [num]: text }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const result = await apiFetch<ContractTypeConfig>(`/contract-types/${config.type}`, {
        method: "PUT",
        body: JSON.stringify({ clauseOverrides: overrides }),
      });
      onSaved(config.type, result);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header do card */}
      <div
        style={{
          padding: "1rem 1.25rem",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: `${color}10`,
          borderBottom: expanded ? `1px solid ${color}30` : "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--navy)", margin: 0 }}>
              {config.displayName}
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: "2px 0 0" }}>
              {isSolutioErp
                ? "Template base — sem overrides"
                : clauseKeys.length > 0
                  ? `${clauseKeys.length} cláusula${clauseKeys.length !== 1 ? "s" : ""} configurada${clauseKeys.length !== 1 ? "s" : ""}: ${clauseKeys.map((k) => `Cl. ${k}`).join(", ")}`
                  : "Nenhuma cláusula configurada"}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: "var(--gray)" }} /> : <ChevronDown size={16} style={{ color: "var(--gray)" }} />}
      </div>

      {expanded && (
        <div style={{ padding: "1.25rem" }}>
          {isSolutioErp ? (
            <p style={{ fontSize: "0.875rem", color: "var(--gray)", fontStyle: "italic" }}>
              Este é o template base. As cláusulas originais são editadas diretamente no editor de Templates.
            </p>
          ) : (
            <>
              {clauseKeys.length === 0 ? (
                <p style={{ fontSize: "0.875rem", color: "var(--gray)", marginBottom: "1rem" }}>
                  Nenhuma cláusula sobrescrita. Clique em <strong>+ Adicionar cláusula</strong> para configurar.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1rem" }}>
                  {clauseKeys.map((num) => (
                    <div key={num}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                        <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--navy)" }}>
                          Cláusula {num}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeClause(num)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#C0392B", padding: "2px 4px", borderRadius: 4, display: "flex", alignItems: "center" }}
                          title="Remover override"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <textarea
                        value={overrides[num]}
                        onChange={(e) => updateClause(num, e.target.value)}
                        placeholder={CLAUSE_HINT}
                        rows={6}
                        style={{
                          width: "100%", padding: "0.625rem 0.875rem",
                          fontSize: "0.8125rem", fontFamily: "inherit",
                          border: "1px solid #D8E3EA", borderRadius: 8,
                          resize: "vertical", outline: "none", boxSizing: "border-box",
                          lineHeight: 1.6, color: "var(--navy)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={addClause}
                  style={{ fontSize: "0.8125rem" }}
                >
                  <Plus size={14} /> Adicionar cláusula
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ fontSize: "0.8125rem" }}
                >
                  <Save size={14} />
                  {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
                </button>
                {error && (
                  <span style={{ fontSize: "0.8125rem", color: "#C0392B" }}>{error}</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
