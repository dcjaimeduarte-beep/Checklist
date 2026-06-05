"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CheckCircle2, Clock3, FileText, XCircle } from "lucide-react";

type StatsItem = { status: string; _count: { id: number } };

const CARDS = [
  {
    status:  "active",
    label:   "Contratos Ativos",
    icon:    CheckCircle2,
    color:   "#0F7A6B",
    bg:      "#E6F5F3",
  },
  {
    status:  "draft",
    label:   "Rascunhos",
    icon:    Clock3,
    color:   "#6B7E8C",
    bg:      "#EEF2F5",
  },
  {
    status:  "terminated",
    label:   "Encerrados / Expirados",
    icon:    FileText,
    color:   "#4A6072",
    bg:      "#E8EEF3",
    extra:   "expired",
  },
  {
    status:  "cancelled",
    label:   "Cancelados",
    icon:    XCircle,
    color:   "#C0392B",
    bg:      "#FEE9E9",
  },
];

export default function DashboardPage() {
  const [stats,   setStats]   = useState<StatsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<StatsItem[]>("/contracts/stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  const count = (s: string) => stats.find((x) => x.status === s)?._count.id ?? 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Visão geral do sistema</p>
        </div>
      </div>

      {loading ? (
        <div className="empty-state" style={{ paddingTop: "2rem" }}>
          <p>Carregando...</p>
        </div>
      ) : (
        <div className="stats-grid">
          {CARDS.map(({ status, label, icon: Icon, color, bg, extra }) => {
            const value = count(status) + (extra ? count(extra) : 0);
            return (
              <div
                key={status}
                className="card p-5 flex flex-col gap-3"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--gray)" }}>
                    {label}
                  </p>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: bg }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                </div>
                <p className="text-3xl font-bold" style={{ color: "var(--navy)", lineHeight: 1 }}>
                  {value}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
