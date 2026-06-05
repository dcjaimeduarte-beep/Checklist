"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { Plus, Search, FileText, CheckCircle2, X, Eye, Check, Pencil, TrendingUp, AlertTriangle, Trash2, Link2, Copy, CheckCheck, RotateCcw } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SOLUTIO_ERP:  "Solutio ERP",
  GCONCILIADOR: "Gconciliador",
  SOLUTIO_WEB:  "Solutio WEB",
};
const CONTRACT_TYPE_COLORS: Record<string, string> = {
  SOLUTIO_ERP:  "#1B7A8C",
  GCONCILIADOR: "#7A5100",
  SOLUTIO_WEB:  "#0F7A6B",
};

type Contract = {
  id: string;
  identifier: string | null;
  status: string;
  contractType: string;
  isSigned: boolean;
  signedAt: string | null;
  signedByName: string | null;
  signedByNameContratante: string | null;
  signTokenExpiresAt: string | null;
  monthlyFee: number;
  implementationFee: number;
  implementationPayment: string;
  discount: number;
  paymentDayOfMonth: number;
  firstPaymentDate: string | null;
  adjustmentIndex: string;
  adjustmentRate: number | null;
  moduleCadastros: boolean;
  moduleFaturamento: boolean;
  moduleFiscal: boolean;
  distanceFromProviderKm: number | null;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  durationMonths: number;
  createdAt: string;
  client: { id: string; razaoSocial: string; cnpj: string | null; revenda: { id: string; name: string } | null };
};

type ClientOption = { id: string; razaoSocial: string; cnpj: string | null; revenda: { name: string } | null };

type DueContract = {
  id: string;
  identifier: string | null;
  monthlyFee: number;
  adjustmentIndex: string;
  adjustmentRate: number | null;
  nextAdjustmentDate: string;
  daysLeft: number;
  client: { razaoSocial: string };
};

type ApiResponse = {
  data: Contract[];
  meta: { total: number; page: number; totalPages: number };
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho", active: "Ativo", terminated: "Encerrado",
  cancelled: "Cancelado", expired: "Expirado",
};
const STATUS_BADGE: Record<string, string> = {
  draft: "badge badge-draft", active: "badge badge-active",
  terminated: "badge badge-terminated", cancelled: "badge badge-cancelled",
  expired: "badge badge-expired",
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
function toIso(date: string) {
  return date ? new Date(date + "T00:00:00").toISOString() : "";
}

// ─── Modal de reajuste ───────────────────────────────────────────────────────

function AdjustmentModal({ contract, onClose, onApplied }: {
  contract: DueContract;
  onClose: () => void;
  onApplied: () => void;
}) {
  const rate = contract.adjustmentRate ?? 0;
  const suggested = contract.monthlyFee * (1 + rate / 100);
  const [newFee, setNewFee] = useState(suggested.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apply() {
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/apply-adjustment`, {
        method: "POST",
        body: JSON.stringify({ newMonthlyFee: parseFloat(newFee) }),
      });
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao aplicar reajuste.");
    } finally {
      setSaving(false);
    }
  }

  const diff = parseFloat(newFee) - contract.monthlyFee;
  const diffPct = contract.monthlyFee > 0 ? (diff / contract.monthlyFee) * 100 : 0;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 440, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(13,34,53,0.2)",
        zIndex: 51, overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#0D2235,#1A3548)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <TrendingUp size={18} style={{ color: "#1B7A8C" }} />
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Aplicar Reajuste</p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", margin: "2px 0 0" }}>{contract.client.razaoSocial}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {/* Corpo */}
        <div style={{ padding: "1.5rem" }}>
          {/* Resumo */}
          <div style={{ background: "#F7FAFB", borderRadius: 10, padding: "1rem", marginBottom: "1.25rem", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", textAlign: "center" }}>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#8B9EB0", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase" }}>Atual</p>
              <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0D2235", margin: 0 }}>{fmt(contract.monthlyFee)}</p>
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#8B9EB0", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase" }}>Índice</p>
              <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#1B7A8C", margin: 0 }}>
                {contract.adjustmentIndex} {rate > 0 ? `${rate}%` : ""}
              </p>
            </div>
            <div>
              <p style={{ fontSize: "0.6875rem", color: "#8B9EB0", margin: "0 0 3px", fontWeight: 600, textTransform: "uppercase" }}>Sugerido</p>
              <p style={{ fontSize: "1.125rem", fontWeight: 800, color: "#0F7A6B", margin: 0 }}>{fmt(suggested)}</p>
            </div>
          </div>

          {/* Input do novo valor */}
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            <label className="form-label">Novo valor da mensalidade (R$)</label>
            <input
              type="number" min="0" step="0.01"
              className="form-input"
              value={newFee}
              onChange={(e) => setNewFee(e.target.value)}
              style={{ fontSize: "1.125rem", fontWeight: 700, textAlign: "center" }}
            />
            {parseFloat(newFee) > 0 && (
              <p style={{ textAlign: "center", fontSize: "0.8125rem", marginTop: "0.5rem", color: diff >= 0 ? "#0F7A6B" : "#C0392B" }}>
                {diff >= 0 ? "▲" : "▼"} {fmt(Math.abs(diff))} ({diffPct.toFixed(2)}%)
              </p>
            )}
          </div>

          {error && (
            <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.625rem", fontSize: "0.8125rem", color: "#c53030", marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn-ghost" onClick={onClose} disabled={saving} style={{ flex: 1 }}>Cancelar</button>
            <button className="btn-primary" onClick={apply} disabled={saving} style={{ flex: 2 }}>
              {saving ? "Aplicando..." : "Confirmar reajuste"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Status de assinatura ─────────────────────────────────────────────────────

function SignatureStatus({ c, onNewLink }: { c: Contract; onNewLink: () => void }) {
  const hasEmpresa  = !!c.signedByName;
  const hasCliente  = !!c.signedByNameContratante;
  const anySign     = hasEmpresa || hasCliente;

  if (c.isSigned || anySign) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {c.isSigned && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <CheckCircle2 size={13} style={{ color: "#0F7A6B", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#0F7A6B" }}>
              {hasEmpresa && hasCliente ? "Ambos assinaram" : "Assinado"}
            </span>
          </div>
        )}
        {[
          { label: "Empresa",  name: c.signedByName,            done: hasEmpresa },
          { label: "Cliente",  name: c.signedByNameContratante, done: hasCliente },
        ].map(({ label, name, done }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <CheckCircle2 size={11} style={{ color: done ? "#0F7A6B" : "#D8E3EA", flexShrink: 0 }} />
            <span style={{ fontSize: "0.6875rem", color: done ? "#4A6072" : "#B0C0CC" }}>
              {label}: {done ? name : "aguardando"}
            </span>
          </div>
        ))}
        {c.signedAt && (
          <span style={{ fontSize: "0.6rem", color: "#B0C0CC" }}>{fmtDate(c.signedAt)}</span>
        )}
      </div>
    );
  }

  if (c.signTokenExpiresAt) {
    const expiresMs = new Date(c.signTokenExpiresAt).getTime();
    const daysLeft  = Math.ceil((expiresMs - Date.now()) / 86_400_000);

    if (daysLeft > 0) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#B07A00", background: "#FFF4E0", border: "1px solid #F5C97A", borderRadius: 99, padding: "2px 8px", display: "inline-block" }}>
            Aguardando
          </span>
          <span style={{ fontSize: "0.6875rem", color: "#8B9EB0" }}>
            Expira em {daysLeft}d
          </span>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "#C0392B", background: "#FEE9E9", border: "1px solid #FDB9B9", borderRadius: 99, padding: "2px 8px", display: "inline-block" }}>
          Link expirou
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onNewLink(); }}
          style={{ fontSize: "0.6875rem", color: "#1B7A8C", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 600, textDecoration: "underline" }}
        >
          Reenviar link
        </button>
      </div>
    );
  }

  return <span style={{ color: "#D8E3EA", fontSize: "0.75rem" }}>—</span>;
}

// ─── Modal confirmar exclusão ─────────────────────────────────────────────────

function DeleteConfirmModal({ contract, onClose, onDeleted }: {
  contract: Contract;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 420, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(13,34,53,0.2)",
        zIndex: 51, overflow: "hidden",
      }}>
        <div style={{ background: "linear-gradient(135deg,#7A1A1A,#A02020)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Trash2 size={18} style={{ color: "#FDB9B9" }} />
            <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Excluir Contrato</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <p style={{ color: "var(--navy)", fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
            Tem certeza que deseja excluir este contrato?
          </p>
          <p style={{ fontWeight: 700, color: "#C0392B", marginBottom: "0.25rem" }}>
            {contract.identifier ?? contract.id.slice(0, 8).toUpperCase()} — {contract.client.razaoSocial}
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--gray)", marginBottom: "1.25rem" }}>
            Esta ação é irreversível. O contrato será removido permanentemente.
          </p>
          {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030", marginBottom: "1rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn-ghost" onClick={onClose} disabled={loading} style={{ flex: 1 }}>Cancelar</button>
            <button
              disabled={loading}
              onClick={handleDelete}
              style={{ flex: 1, padding: "0.625rem 1rem", borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Excluindo..." : "Excluir definitivamente"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Modal link de assinatura ─────────────────────────────────────────────────

function SignLinkModal({ contract, onClose }: { contract: Contract; onClose: () => void }) {
  const [url,     setUrl]     = useState("");
  const [expires, setExpires] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    apiFetch<{ url: string; expiresAt: string }>(`/contracts/${contract.id}/sign-link`, { method: "POST" })
      .then((r) => { setUrl(r.url); setExpires(r.expiresAt); })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao gerar link."))
      .finally(() => setLoading(false));
  }, [contract.id]);

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 500, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(13,34,53,0.2)",
        zIndex: 51, overflow: "hidden",
      }}>
        <div style={{ background: "linear-gradient(135deg,#0D2235,#1A3548)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Link2 size={18} style={{ color: "#1B7A8C" }} />
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Link de Assinatura Online</p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", margin: "2px 0 0" }}>{contract.client.razaoSocial}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          {loading ? (
            <p style={{ color: "var(--gray)", fontSize: "0.875rem" }}>Gerando link seguro...</p>
          ) : error ? (
            <p style={{ color: "#C0392B", fontSize: "0.875rem" }}>{error}</p>
          ) : (
            <>
              <p style={{ fontSize: "0.875rem", color: "var(--navy)", marginBottom: "0.75rem" }}>
                Envie este link para o cliente assinar o contrato digitalmente. Válido por <strong>7 dias</strong>.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input
                  readOnly
                  value={url}
                  style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", border: "1px solid #D8E3EA", borderRadius: 8, background: "#F7FAFB", color: "var(--navy)", outline: "none", fontFamily: "monospace" }}
                />
                <button
                  onClick={copyUrl}
                  style={{ padding: "0.5rem 1rem", borderRadius: 8, border: "none", background: copied ? "#0F7A6B" : "var(--teal)", color: "#fff", fontWeight: 600, fontSize: "0.8125rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", whiteSpace: "nowrap" }}
                >
                  {copied ? <><CheckCheck size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                </button>
              </div>
              {expires && (
                <p style={{ fontSize: "0.75rem", color: "var(--gray)" }}>
                  Expira em: {new Date(expires).toLocaleString("pt-BR")}
                </p>
              )}
              <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 8 }}>
                <p style={{ fontSize: "0.8125rem", color: "#7A5100", margin: 0 }}>
                  Ao acessar o link, o cliente verá o documento completo e poderá assinar digitalmente. A assinatura registra nome, data e IP do assinante.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Modal resetar assinaturas ───────────────────────────────────────────────

function ResetSignaturesModal({ contract, onClose, onReset }: {
  contract: Contract;
  onClose: () => void;
  onReset: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleReset() {
    setLoading(true);
    setError("");
    try {
      await apiFetch(`/contracts/${contract.id}/reset-signatures`, { method: "PATCH" });
      onReset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao resetar.");
      setLoading(false);
    }
  }

  const hasBoth = !!contract.signedByName && !!contract.signedByNameContratante;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 440, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(13,34,53,0.2)",
        zIndex: 51, overflow: "hidden",
      }}>
        <div style={{ background: "linear-gradient(135deg,#5A3A00,#7A5100)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <RotateCcw size={18} style={{ color: "#F5C97A" }} />
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Resetar Assinaturas</p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem", margin: "2px 0 0" }}>{contract.client.razaoSocial}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--navy)", marginBottom: "0.75rem" }}>
            Isso vai remover <strong>todas as assinaturas</strong> registradas e deixar o contrato em aberto novamente.
          </p>

          {/* Assinaturas existentes */}
          <div style={{ background: "#F7FAFB", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {[
              { label: "Empresa (Contratada)",  name: contract.signedByName },
              { label: "Cliente (Contratante)", name: contract.signedByNameContratante },
            ].map(({ label, name }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                <CheckCircle2 size={13} style={{ color: name ? "#0F7A6B" : "#D8E3EA", flexShrink: 0 }} />
                <span style={{ color: name ? "#0D2235" : "var(--gray)" }}>
                  {label}: {name ?? "não assinou"}
                </span>
              </div>
            ))}
          </div>

          {!hasBoth && (
            <p style={{ fontSize: "0.8125rem", color: "#B07A00", background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "1rem" }}>
              Apenas uma parte assinou. Ao resetar, será necessário gerar um novo link.
            </p>
          )}

          {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030", marginBottom: "1rem" }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn-ghost" onClick={onClose} disabled={loading} style={{ flex: 1 }}>Cancelar</button>
            <button
              disabled={loading}
              onClick={handleReset}
              style={{ flex: 1, padding: "0.625rem 1rem", borderRadius: 8, border: "none", background: "#B07A00", color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Resetando..." : "Confirmar reset"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Checkbox estilizado ──────────────────────────────────────────────────────

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", userSelect: "none" }}
      onClick={() => onChange(!checked)}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4,
        border: `2px solid ${checked ? "var(--teal)" : "#D8E3EA"}`,
        background: checked ? "var(--teal)" : "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "all 0.15s",
      }}>
        {checked && <Check size={11} color="#fff" strokeWidth={3} />}
      </div>
      <span style={{ fontSize: "0.875rem", color: "var(--navy)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

// ─── Drawer de criação de contrato ────────────────────────────────────────────

type ContractForm = {
  clientId: string;
  identifier: string;
  contractType: string;
  startDate: string;
  durationMonths: number;
  implementationFee: number;
  implementationPayment: string;
  monthlyFee: number;
  discount: number;
  paymentDayOfMonth: number;
  firstPaymentDate: string;
  adjustmentIndex: string;
  adjustmentRate: string;
  moduleCadastros: boolean;
  moduleFaturamento: boolean;
  moduleFiscal: boolean;
  distanceFromProviderKm: string;
  notes: string;
};

const EMPTY: ContractForm = {
  clientId: "", identifier: "", contractType: "SOLUTIO_ERP", startDate: "", durationMonths: 12,
  implementationFee: 0, implementationPayment: "avista",
  monthlyFee: 0, discount: 0, paymentDayOfMonth: 10, firstPaymentDate: "",
  adjustmentIndex: "IGPM", adjustmentRate: "", moduleCadastros: false,
  moduleFaturamento: false, moduleFiscal: false,
  distanceFromProviderKm: "", notes: "",
};

function ContractDrawer({ onClose, onSaved, editId, initialData, initialClient }: {
  onClose: () => void;
  onSaved: () => void;
  editId?: string;
  initialData?: Partial<ContractForm>;
  initialClient?: ClientOption;
}) {
  const isEdit = !!editId;
  const [form, setForm] = useState<ContractForm>({ ...EMPTY, ...initialData });
  const [clientSearch, setClientSearch] = useState(initialClient?.razaoSocial ?? "");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(initialClient ?? null);
  const [showClientList, setShowClientList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContractForm, string>>>({});
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  function updateDropdownPos() {
    if (!clientInputRef.current) return;
    const r = clientInputRef.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  // Busca clientes com debounce + cancelamento de requisição anterior
  useEffect(() => {
    if (!showClientList) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setClientsLoading(true);
      const p = new URLSearchParams({ limit: "30" });
      if (clientSearch.trim()) p.set("search", clientSearch.trim());
      apiFetch<{ data: ClientOption[] }>(`/clients?${p}`, { signal: controller.signal })
        .then((r) => { if (!controller.signal.aborted) setClients(r.data); })
        .catch(() => { if (!controller.signal.aborted) setClients([]); })
        .finally(() => { if (!controller.signal.aborted) setClientsLoading(false); });
    }, 250);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [clientSearch, showClientList]);

  function setField<K extends keyof ContractForm>(field: K, value: ContractForm[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((e) => ({ ...e, [field]: "" }));
  }

  function selectClient(c: ClientOption) {
    setSelectedClient(c);
    setForm((f) => ({ ...f, clientId: c.id }));
    setShowClientList(false);
    setClientSearch(c.razaoSocial);
    setFieldErrors((e) => ({ ...e, clientId: "" }));
  }

  function validate() {
    const e: Partial<Record<keyof ContractForm, string>> = {};
    if (!form.clientId) e.clientId = "Selecione um cliente";
    if (!form.startDate) e.startDate = "Data de início é obrigatória";
    if (form.monthlyFee <= 0) e.monthlyFee = "Informe a mensalidade";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setError("");
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        clientId: form.clientId,
        contractType: form.contractType,
        startDate: toIso(form.startDate),
        durationMonths: form.durationMonths,
        implementationFee: form.implementationFee,
        implementationPayment: form.implementationPayment,
        monthlyFee: form.monthlyFee,
        discount: form.discount,
        paymentDayOfMonth: form.paymentDayOfMonth,
        ...(form.adjustmentRate ? { adjustmentRate: parseFloat(form.adjustmentRate) } : {}),
        adjustmentIndex: form.adjustmentIndex,
        moduleCadastros: form.moduleCadastros,
        moduleFaturamento: form.moduleFaturamento,
        moduleFiscal: form.moduleFiscal,
      };
      if (form.identifier.trim())        body.identifier            = form.identifier.trim();
      if (form.firstPaymentDate)         body.firstPaymentDate      = toIso(form.firstPaymentDate);
      if (form.distanceFromProviderKm)   body.distanceFromProviderKm = parseInt(form.distanceFromProviderKm);
      if (form.notes.trim())             body.notes                 = form.notes.trim();

      if (isEdit) {
        await apiFetch(`/contracts/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/contracts", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const label = (text: string, opt = false) => (
    <label className="form-label">
      {text} {opt && <span className="form-label-optional">(opcional)</span>}
    </label>
  );

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 560 }}>

        {/* Header */}
        <div className="drawer-header">
          <div>
            <p className="drawer-title">{isEdit ? "Editar Contrato" : "Novo Contrato"}</p>
            <p className="drawer-subtitle">{isEdit ? "Altere os dados do contrato" : "Preencha os dados do contrato de prestação de serviços"}</p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="drawer-body">

          {/* Cliente */}
          <div className="form-section">
            <p className="form-section-title">Cliente</p>
            <div className="form-group">
              {label("Selecione o cliente")}
              <input
                ref={clientInputRef}
                className={`form-input${fieldErrors.clientId ? " error" : ""}`}
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setSelectedClient(null);
                  setForm(f => ({ ...f, clientId: "" }));
                  updateDropdownPos();
                  setShowClientList(true);
                }}
                onFocus={() => { updateDropdownPos(); setShowClientList(true); }}
                onBlur={() => setTimeout(() => setShowClientList(false), 150)}
                placeholder="Digite para buscar..."
                autoComplete="off"
              />
              {fieldErrors.clientId && <span className="form-error">{fieldErrors.clientId}</span>}
              {showClientList && dropdownPos && (
                <div style={{
                  position: "fixed",
                  top: dropdownPos.top,
                  left: dropdownPos.left,
                  width: dropdownPos.width,
                  zIndex: 9999,
                  background: "#fff",
                  border: "1px solid #D8E3EA",
                  borderRadius: 8,
                  boxShadow: "0 4px 16px rgba(13,34,53,0.12)",
                  maxHeight: 220,
                  overflowY: "auto",
                }}>
                  {clientsLoading ? (
                    <div style={{ padding: "0.75rem 1rem", color: "var(--gray)", fontSize: "0.8125rem" }}>Buscando...</div>
                  ) : clients.length === 0 ? (
                    <div style={{ padding: "0.75rem 1rem", color: "var(--gray)", fontSize: "0.8125rem" }}>Nenhum cliente encontrado</div>
                  ) : clients.map((c) => (
                    <div
                      key={c.id}
                      onMouseDown={(e) => { e.preventDefault(); selectClient(c); }}
                      style={{
                        padding: "0.625rem 1rem", cursor: "pointer", borderBottom: "1px solid #F0F4F7",
                        fontSize: "0.875rem", color: "var(--navy)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F7FAFB")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 500 }}>{c.razaoSocial}</span>
                        {c.revenda ? (
                          <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#0F7A6B", background: "#0F7A6B15", borderRadius: 99, padding: "1px 6px" }}>
                            {c.revenda.name}
                          </span>
                        ) : (
                          <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#1B7A8C", background: "#1B7A8C12", borderRadius: 99, padding: "1px 6px" }}>
                            Matriz
                          </span>
                        )}
                      </div>
                      {c.cnpj && <div style={{ fontSize: "0.75rem", color: "var(--gray)", marginTop: "1px" }}>{c.cnpj}</div>}
                    </div>
                  ))}
                </div>
              )}
              {selectedClient && (
                <div style={{ marginTop: "0.375rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <CheckCircle2 size={13} style={{ color: "#0F7A6B" }} />
                  <span style={{ fontSize: "0.75rem", color: "#0F7A6B", fontWeight: 500 }}>
                    {selectedClient.razaoSocial} selecionado
                  </span>
                  {selectedClient.revenda ? (
                    <span style={{ fontSize: "0.625rem", fontWeight: 700, color: "#0F7A6B", background: "#0F7A6B15", borderRadius: 99, padding: "1px 6px" }}>
                      {selectedClient.revenda.name}
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.625rem", fontWeight: 600, color: "#1B7A8C", background: "#1B7A8C12", borderRadius: 99, padding: "1px 6px" }}>
                      Matriz
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Identificação */}
          <div className="form-section">
            <p className="form-section-title">Identificação</p>

            {/* Tipo de contrato */}
            <div className="form-group" style={{ marginBottom: "1rem" }}>
              {label("Tipo de Contrato / Produto")}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "0.25rem" }}>
                {(["SOLUTIO_ERP", "GCONCILIADOR", "SOLUTIO_WEB"] as const).map((t) => {
                  const selected = form.contractType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setField("contractType", t)}
                      style={{
                        padding: "0.5rem 0.25rem",
                        borderRadius: 8,
                        border: `2px solid ${selected ? CONTRACT_TYPE_COLORS[t] : "#D8E3EA"}`,
                        background: selected ? `${CONTRACT_TYPE_COLORS[t]}12` : "#fff",
                        cursor: "pointer",
                        textAlign: "center",
                        transition: "all 0.15s",
                        fontWeight: selected ? 700 : 500,
                        fontSize: "0.8125rem",
                        color: selected ? CONTRACT_TYPE_COLORS[t] : "var(--navy)",
                      }}
                    >
                      {CONTRACT_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Nº do Contrato", true)}
                <input className="form-input" value={form.identifier}
                  onChange={(e) => setField("identifier", e.target.value)}
                  placeholder="Ex: 12052025" />
              </div>
              <div className="form-group">
                {label("Data de Início")}
                <input type="date" className={`form-input${fieldErrors.startDate ? " error" : ""}`}
                  value={form.startDate} onChange={(e) => setField("startDate", e.target.value)} />
                {fieldErrors.startDate && <span className="form-error">{fieldErrors.startDate}</span>}
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Prazo (meses)")}
                <select className="form-input" value={form.durationMonths}
                  onChange={(e) => setField("durationMonths", parseInt(e.target.value))}>
                  {[6,12,18,24,36,48,60].map(m => (
                    <option key={m} value={m}>{m} {m === 12 ? "(1 ano)" : m === 24 ? "(2 anos)" : "meses"}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                {label("Índice de Reajuste")}
                <select className="form-input" value={form.adjustmentIndex}
                  onChange={(e) => setField("adjustmentIndex", e.target.value)}>
                  {["IGPM","IPCA","INPC","IGP-DI"].map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="form-group">
                {label("% do Índice", true)}
                <div style={{ position: "relative" }}>
                  <input type="number" min="0" max="100" step="0.01" className="form-input"
                    value={form.adjustmentRate}
                    onChange={(e) => setField("adjustmentRate", e.target.value)}
                    placeholder="Ex: 5,82"
                    style={{ paddingRight: "2rem" }}
                  />
                  <span style={{ position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.8125rem", color: "var(--gray)", pointerEvents: "none" }}>%</span>
                </div>
                <span style={{ fontSize: "0.65rem", color: "var(--gray)", marginTop: 2, display: "block" }}>
                  Taxa de reajuste anual acordada
                </span>
              </div>
            </div>
          </div>

          {/* Financeiro */}
          <div className="form-section">
            <p className="form-section-title">Financeiro</p>
            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Mensalidade (R$)")}
                <input type="number" min="0" step="0.01"
                  className={`form-input${fieldErrors.monthlyFee ? " error" : ""}`}
                  value={form.monthlyFee || ""}
                  onChange={(e) => setField("monthlyFee", parseFloat(e.target.value) || 0)}
                  placeholder="0,00" />
                {fieldErrors.monthlyFee && <span className="form-error">{fieldErrors.monthlyFee}</span>}
              </div>
              <div className="form-group">
                {label("Desconto (R$)", true)}
                <input type="number" min="0" step="0.01" className="form-input"
                  value={form.discount || ""}
                  onChange={(e) => setField("discount", parseFloat(e.target.value) || 0)}
                  placeholder="0,00" />
                {form.discount > 0 && form.monthlyFee > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "#0F7A6B", marginTop: 2, display: "block" }}>
                    Valor líquido: R$ {(form.monthlyFee - form.discount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Dia de Vencimento")}
                <input type="number" min="1" max="31" className="form-input"
                  value={form.paymentDayOfMonth}
                  onChange={(e) => setField("paymentDayOfMonth", parseInt(e.target.value) || 10)} />
              </div>
              <div className="form-group">
                {label("1ª Parcela em", true)}
                <input type="date" className="form-input" value={form.firstPaymentDate}
                  onChange={(e) => setField("firstPaymentDate", e.target.value)} />
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Implantação (R$)", true)}
                <input type="number" min="0" step="0.01" className="form-input"
                  value={form.implementationFee || ""}
                  onChange={(e) => setField("implementationFee", parseFloat(e.target.value) || 0)}
                  placeholder="0,00" />
              </div>
              <div className="form-group">
                {label("Pagto. Implantação")}
                <select className="form-input" value={form.implementationPayment}
                  onChange={(e) => setField("implementationPayment", e.target.value)}>
                  <option value="avista">À vista</option>
                  <option value="parcelado">Parcelado</option>
                </select>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                {label("Distância da sede (km)", true)}
                <input type="number" min="0" className="form-input"
                  value={form.distanceFromProviderKm}
                  onChange={(e) => setField("distanceFromProviderKm", e.target.value)}
                  placeholder="0" />
              </div>
            </div>
          </div>

          {/* Módulos */}
          <div className="form-section">
            <p className="form-section-title">Módulos Contratados</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Checkbox checked={form.moduleCadastros}    onChange={(v) => setField("moduleCadastros",    v)} label="Cadastros" />
              <Checkbox checked={form.moduleFaturamento}  onChange={(v) => setField("moduleFaturamento",  v)} label="Faturamento" />
              <Checkbox checked={form.moduleFiscal}       onChange={(v) => setField("moduleFiscal",       v)} label="Fiscal" />
            </div>
          </div>

          {/* Observações */}
          <div className="form-section">
            <p className="form-section-title">Observações</p>
            <textarea className="form-input"
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Observações adicionais sobre o contrato..."
              style={{ minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#c53030" }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar contrato"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ContractsPage() {
  const router = useRouter();
  const [data,        setData]        = useState<Contract[]>([]);
  const [meta,        setMeta]        = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status,      setStatus]      = useState("");
  const [showDrawer,    setShowDrawer]    = useState(false);
  const [editContract,  setEditContract]  = useState<{ id: string; data: Partial<ContractForm>; client: ClientOption } | null>(null);
  const [due,           setDue]           = useState<DueContract[]>([]);
  const [adjusting,     setAdjusting]     = useState<DueContract | null>(null);
  const [deleting,      setDeleting]      = useState<Contract | null>(null);
  const [signLinking,   setSignLinking]   = useState<Contract | null>(null);
  const [resetting,     setResetting]     = useState<Contract | null>(null);
  const currentUser = getCurrentUser();

  // Debounce de 300ms na busca para evitar disparo a cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    try {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) p.set("status", status);
      if (debouncedSearch) p.set("search", debouncedSearch);
      const res = await apiFetch<ApiResponse>(`/contracts?${p}`, { signal: controller.signal } as RequestInit);
      setData(res.data);
      setMeta(res.meta);
    } catch (e) {
      if ((e as Error).name !== "AbortError") throw e;
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  }, [page, debouncedSearch, status]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    apiFetch<DueContract[]>("/contracts/due-for-adjustment?days=60")
      .then(setDue).catch(() => {});
  }, []);

  function handleSearch(v: string) { setSearch(v); setPage(1); }
  function handleStatus(v: string) { setStatus(v); setPage(1); }
  function handleSaved() { setShowDrawer(false); setEditContract(null); void load(); }

  async function openEdit(c: Contract) {
    // Busca contrato completo para ter todos os campos
    const full = await apiFetch<Contract>(`/contracts/${c.id}`);
    setEditContract({
      id: full.id,
      client: full.client,
      data: {
        clientId:              full.client.id,
        identifier:            full.identifier ?? "",
        startDate:             full.startDate ? full.startDate.slice(0, 10) : "",
        durationMonths:        full.durationMonths,
        monthlyFee:            full.monthlyFee,
        implementationFee:     full.implementationFee,
        implementationPayment: full.implementationPayment,
        discount:              full.discount ?? 0,
        paymentDayOfMonth:     full.paymentDayOfMonth,
        firstPaymentDate:      full.firstPaymentDate ? full.firstPaymentDate.slice(0, 10) : "",
        contractType:          full.contractType ?? "SOLUTIO_ERP",
        adjustmentIndex:       full.adjustmentIndex,
        adjustmentRate:        full.adjustmentRate != null ? String(full.adjustmentRate) : "",
        moduleCadastros:       full.moduleCadastros,
        moduleFaturamento:     full.moduleFaturamento,
        moduleFiscal:          full.moduleFiscal,
        distanceFromProviderKm: full.distanceFromProviderKm != null ? String(full.distanceFromProviderKm) : "",
        notes:                 full.notes ?? "",
      },
    });
  }

  return (
    <div>
      {adjusting && (
        <AdjustmentModal
          contract={adjusting}
          onClose={() => setAdjusting(null)}
          onApplied={() => { setAdjusting(null); setDue(d => d.filter(c => c.id !== adjusting.id)); void load(); }}
        />
      )}

      {deleting    && <DeleteConfirmModal   contract={deleting}    onClose={() => setDeleting(null)}    onDeleted={() => { setDeleting(null); void load(); }} />}
      {signLinking && <SignLinkModal        contract={signLinking} onClose={() => setSignLinking(null)} />}
      {resetting   && <ResetSignaturesModal contract={resetting}   onClose={() => setResetting(null)}   onReset={() => { setResetting(null); void load(); }} />}

      {showDrawer && <ContractDrawer onClose={() => setShowDrawer(false)} onSaved={handleSaved} />}
      {editContract && (
        <ContractDrawer
          onClose={() => setEditContract(null)}
          onSaved={handleSaved}
          editId={editContract.id}
          initialData={editContract.data}
          initialClient={editContract.client}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Contratos</h1>
          <p className="page-subtitle">{meta.total} contrato{meta.total !== 1 ? "s" : ""} no sistema</p>
        </div>
        <button className="btn-primary" onClick={() => setShowDrawer(true)}>
          <Plus size={15} /> Novo contrato
        </button>
      </div>

      {/* Banner de alertas de reajuste */}
      {due.length > 0 && (
        <div style={{ background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <AlertTriangle size={16} style={{ color: "#B07A00", flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: "0.875rem", color: "#7A5100", margin: 0 }}>
            <strong>{due.length} contrato{due.length !== 1 ? "s" : ""}</strong> com reajuste nos próximos 60 dias.
            {due[0] && ` Mais urgente: ${due[0].client.razaoSocial} (${due[0].daysLeft} dias).`}
          </p>
          <button
            className="btn-ghost"
            style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderColor: "#F5C97A", color: "#7A5100", whiteSpace: "nowrap" }}
            onClick={() => setAdjusting(due[0])}
          >
            <TrendingUp size={13} /> Aplicar reajuste
          </button>
        </div>
      )}

      <div className="toolbar">
        <div className="toolbar-search">
          <Search size={14} />
          <input className="toolbar-input" placeholder="Buscar por cliente ou identificador..."
            value={search} onChange={(e) => handleSearch(e.target.value)} />
        </div>
        <select className="toolbar-select" value={status} onChange={(e) => handleStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Cliente</th>
              <th>Início</th>
              <th>Prazo</th>
              <th className="right">Mensalidade</th>
              <th>Assinatura</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8}><div className="empty-state"><p>Carregando...</p></div></td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={8}>
                <div className="empty-state">
                  <FileText size={36} />
                  <p>Nenhum contrato encontrado</p>
                </div>
              </td></tr>
            ) : data.map((c) => (
              <tr key={c.id} style={{ cursor: "default" }}>
                <td>
                  <span className="mono">{c.identifier ?? c.id.slice(0, 8).toUpperCase()}</span>
                  <span style={{
                    display: "block", marginTop: 3, fontSize: "0.6875rem", fontWeight: 600,
                    color: CONTRACT_TYPE_COLORS[c.contractType] ?? "#1B7A8C",
                    background: `${CONTRACT_TYPE_COLORS[c.contractType] ?? "#1B7A8C"}15`,
                    borderRadius: 99, padding: "1px 7px", width: "fit-content",
                  }}>
                    {CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 500 }}>{c.client.razaoSocial}</span>
                  {c.client.cnpj && <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{c.client.cnpj}</span>}
                  {c.client.revenda ? (
                    <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.625rem", fontWeight: 700, color: "#0F7A6B", background: "#0F7A6B15", borderRadius: 99, padding: "1px 6px" }}>
                      {c.client.revenda.name}
                    </span>
                  ) : (
                    <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.625rem", fontWeight: 600, color: "#1B7A8C", background: "#1B7A8C12", borderRadius: 99, padding: "1px 6px" }}>
                      Matriz
                    </span>
                  )}
                </td>
                <td className="muted">{fmtDate(c.startDate)}</td>
                <td className="muted">{c.durationMonths}m</td>
                <td className="right" style={{ fontWeight: 500 }}>R$ {fmt(c.monthlyFee)}</td>
                <td>
                  <SignatureStatus c={c} onNewLink={() => setSignLinking(c)} />
                </td>
                <td>
                  <span className={STATUS_BADGE[c.status] ?? "badge badge-draft"}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                </td>
                <td>
                  {(() => {
                    const isRevenda = currentUser?.role === "revenda";
                    const blockedBySign = isRevenda && c.isSigned;
                    return (
                      <div style={{ display: "flex", gap: "0.375rem" }}>
                        {!blockedBySign && (
                          <button
                            className="btn-ghost"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                            onClick={() => openEdit(c)}
                            title="Editar contrato"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        <button
                          className="btn-ghost"
                          style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                          onClick={() => router.push(`/dashboard/contracts/${c.id}/preview`)}
                          title="Ver contrato gerado"
                        >
                          <Eye size={13} /> Ver
                        </button>
                        {!c.isSigned && (
                          <button
                            className="btn-ghost"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#1B7A8C" }}
                            onClick={() => setSignLinking(c)}
                            title="Gerar link de assinatura online"
                          >
                            <Link2 size={13} />
                          </button>
                        )}
                        {(c.signedByName || c.signedByNameContratante || c.isSigned) && !isRevenda && (
                          <button
                            className="btn-ghost"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#B07A00" }}
                            title="Resetar assinaturas"
                            onClick={() => setResetting(c)}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                        {!blockedBySign && (
                          <button
                            className="btn-ghost"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#C0392B" }}
                            onClick={() => setDeleting(c)}
                            title="Excluir contrato"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination page={page} totalPages={meta.totalPages} total={meta.total} label="contratos" onPageChange={setPage} />
      </div>
    </div>
  );
}
