"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Clock3, FileText, XCircle,
  AlertTriangle, TrendingUp, DollarSign, Users, Bell,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatsItem = { status: string; _count: { id: number } };

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

type FinancialSummary = {
  totalActiveContracts: number;
  totalMonthlyRevenue: number;
  totalAnnualRevenue: number;
  avgMonthlyFee: number;
  contractsWithImplementation: number;
  totalImplementationRevenue: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STAT_CARDS = [
  { status: "active",     label: "Contratos Ativos",       icon: CheckCircle2, color: "#0F7A6B", bg: "#E6F5F3" },
  { status: "draft",      label: "Rascunhos",               icon: Clock3,       color: "#6B7E8C", bg: "#EEF2F5" },
  { status: "terminated", label: "Encerrados / Expirados",  icon: FileText,     color: "#4A6072", bg: "#E8EEF3", extra: "expired" },
  { status: "cancelled",  label: "Cancelados",              icon: XCircle,      color: "#C0392B", bg: "#FEE9E9" },
];

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function urgencyColor(days: number) {
  if (days <= 7)  return { bg: "#FEE9E9", color: "#C0392B", border: "#FDB9B9" };
  if (days <= 30) return { bg: "#FFF4E0", color: "#B07A00", border: "#F5C97A" };
  return            { bg: "#EEF9F5",  color: "#0F7A6B", border: "#A3D9C9" };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [stats,    setStats]    = useState<StatsItem[]>([]);
  const [due,      setDue]      = useState<DueContract[]>([]);
  const [finance,  setFinance]  = useState<FinancialSummary | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<StatsItem[]>("/contracts/stats"),
      apiFetch<DueContract[]>("/contracts/due-for-adjustment?days=60"),
      apiFetch<{ data: any[] }>("/contracts?status=active&limit=100"),
    ])
      .then(([s, d, activeRes]) => {
        setStats(s);
        setDue(d);

        // Calcula resumo financeiro a partir dos contratos ativos
        const active = activeRes.data as any[];
        const totalMonthlyRevenue = active.reduce((sum, c) => sum + (c.monthlyFee - (c.discount ?? 0)), 0);
        const totalImplementation = active.filter(c => c.implementationFee > 0);
        setFinance({
          totalActiveContracts: active.length,
          totalMonthlyRevenue,
          totalAnnualRevenue: totalMonthlyRevenue * 12,
          avgMonthlyFee: active.length > 0 ? totalMonthlyRevenue / active.length : 0,
          contractsWithImplementation: totalImplementation.length,
          totalImplementationRevenue: totalImplementation.reduce((s, c) => s + c.implementationFee, 0),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const count = (s: string) => stats.find((x) => x.status === s)?._count.id ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* ── Alertas de reajuste ── */}
      {!loading && due.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
            <Bell size={16} style={{ color: "#B07A00" }} />
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0D2235", margin: 0 }}>
              Reajustes nos próximos 60 dias
            </h2>
            <span style={{ fontSize: "0.6875rem", fontWeight: 700, background: "#FFF4E0", color: "#B07A00", padding: "2px 8px", borderRadius: 99 }}>
              {due.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {due.map((c) => {
              const urg = urgencyColor(c.daysLeft);
              const newFee = c.adjustmentRate
                ? c.monthlyFee * (1 + c.adjustmentRate / 100)
                : null;
              return (
                <div
                  key={c.id}
                  onClick={() => router.push("/dashboard/contracts")}
                  style={{
                    display: "flex", alignItems: "center", gap: "1rem",
                    background: urg.bg, border: `1px solid ${urg.border}`,
                    borderRadius: 10, padding: "0.75rem 1rem",
                    cursor: "pointer", transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <AlertTriangle size={16} style={{ color: urg.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem", color: "#0D2235", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.client.razaoSocial}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#6B7E8C", margin: "2px 0 0" }}>
                      Reajuste em {fmtDate(c.nextAdjustmentDate)} · {c.adjustmentIndex}
                      {c.adjustmentRate ? ` · ${c.adjustmentRate}%` : ""}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: "0.8125rem", color: urg.color, margin: 0 }}>
                      {c.daysLeft <= 0 ? "Vencido!" : `${c.daysLeft} dias`}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#6B7E8C", margin: "2px 0 0" }}>
                      {fmtCurrency(c.monthlyFee)}
                      {newFee ? ` → ${fmtCurrency(newFee)}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cards de status ── */}
      <div>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0D2235", margin: "0 0 0.875rem" }}>
          Situação dos Contratos
        </h2>
        {loading ? (
          <div className="empty-state" style={{ paddingTop: "2rem" }}><p>Carregando...</p></div>
        ) : (
          <div className="stats-grid">
            {STAT_CARDS.map(({ status, label, icon: Icon, color, bg, extra }) => {
              const value = count(status) + (extra ? count(extra) : 0);
              return (
                <div key={status} className="card" style={{ padding: "1.25rem", borderTop: `3px solid ${color}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: 0 }}>
                      {label}
                    </p>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon size={16} style={{ color }} />
                    </div>
                  </div>
                  <p style={{ fontSize: "2rem", fontWeight: 800, color: "#0D2235", margin: 0, lineHeight: 1 }}>{value}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Análise financeira ── */}
      {!loading && finance && (
        <div>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#0D2235", margin: "0 0 0.875rem" }}>
            Análise Financeira
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>

            {/* Receita mensal */}
            <div className="card" style={{ padding: "1.25rem", borderTop: "3px solid #1B7A8C" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: 0 }}>
                  Receita Mensal
                </p>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(27,122,140,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DollarSign size={15} style={{ color: "#1B7A8C" }} />
                </div>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D2235", margin: "0 0 2px", lineHeight: 1 }}>
                {fmtCurrency(finance.totalMonthlyRevenue)}
              </p>
              <p style={{ fontSize: "0.7rem", color: "#8B9EB0", margin: 0 }}>
                {finance.totalActiveContracts} contrato{finance.totalActiveContracts !== 1 ? "s" : ""} ativos
              </p>
            </div>

            {/* Receita anual projetada */}
            <div className="card" style={{ padding: "1.25rem", borderTop: "3px solid #0D2235" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: 0 }}>
                  Projeção Anual
                </p>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E8EEF3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={15} style={{ color: "#0D2235" }} />
                </div>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D2235", margin: "0 0 2px", lineHeight: 1 }}>
                {fmtCurrency(finance.totalAnnualRevenue)}
              </p>
              <p style={{ fontSize: "0.7rem", color: "#8B9EB0", margin: 0 }}>
                Baseada na receita atual × 12
              </p>
            </div>

            {/* Ticket médio */}
            <div className="card" style={{ padding: "1.25rem", borderTop: "3px solid #6B7E8C" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: 0 }}>
                  Ticket Médio
                </p>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EEF2F5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={15} style={{ color: "#6B7E8C" }} />
                </div>
              </div>
              <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D2235", margin: "0 0 2px", lineHeight: 1 }}>
                {fmtCurrency(finance.avgMonthlyFee)}
              </p>
              <p style={{ fontSize: "0.7rem", color: "#8B9EB0", margin: 0 }}>
                Mensalidade média por contrato
              </p>
            </div>

            {/* Implantações */}
            {finance.totalImplementationRevenue > 0 && (
              <div className="card" style={{ padding: "1.25rem", borderTop: "3px solid #0F7A6B" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: 0 }}>
                    Implantações
                  </p>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "#E6F5F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileText size={15} style={{ color: "#0F7A6B" }} />
                  </div>
                </div>
                <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0D2235", margin: "0 0 2px", lineHeight: 1 }}>
                  {fmtCurrency(finance.totalImplementationRevenue)}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#8B9EB0", margin: 0 }}>
                  {finance.contractsWithImplementation} contrato{finance.contractsWithImplementation !== 1 ? "s" : ""} com implantação
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
