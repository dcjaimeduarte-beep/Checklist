"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, FileText, Users, LogOut, LayoutTemplate, DollarSign, Layers, Store } from "lucide-react";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard",                                   label: "Dashboard",      icon: LayoutDashboard },
  { href: "/dashboard/clients",                           label: "Clientes",       icon: Building2 },
  { href: "/dashboard/contracts",                         label: "Contratos",      icon: FileText },
  { href: "/dashboard/templates",                         label: "Templates",      icon: LayoutTemplate },
  { href: "/dashboard/settings/contract-types",           label: "Tipos de Contr.",icon: Layers },
  { href: "/dashboard/financeiro",                        label: "Financeiro",     icon: DollarSign },
  { href: "/dashboard/revendas",                          label: "Revendas",       icon: Store },
  { href: "/dashboard/users",                             label: "Usuários",       icon: Users },
];

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <aside className={`dashboard-sidebar${open ? " open" : ""}`}>
      {/* Logo */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{
          background: "#fff",
          borderRadius: 10,
          padding: "5px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/seven-vertical.png"
            alt="Seven Sistemas de Automação"
            style={{ height: 34, width: "auto", display: "block" }}
          />
        </div>
        <div>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.875rem", letterSpacing: "0.14em", lineHeight: 1 }}>
            SEVEN
          </p>
          <p style={{ color: "rgba(139,158,176,0.7)", fontSize: "0.6rem", letterSpacing: "0.06em", marginTop: "3px" }}>
            SISTEMAS DE AUTOMAÇÃO
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "1rem 0.75rem", display: "flex", flexDirection: "column", gap: "2px" }}>
        <p style={{ color: "rgba(139,158,176,0.4)", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", padding: "0 0.5rem", marginBottom: "0.5rem" }}>
          Menu
        </p>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                background: active ? "rgba(27,122,140,0.2)" : "transparent",
                color: active ? "#fff" : "rgba(139,158,176,0.75)",
                borderLeft: active ? "2px solid #1B7A8C" : "2px solid transparent",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(139,158,176,0.75)";
                }
              }}
            >
              <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={() => { clearToken(); onClose?.(); router.push("/login"); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "8px",
            fontSize: "0.875rem",
            width: "100%",
            background: "transparent",
            border: "none",
            color: "rgba(139,158,176,0.6)",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#fff";
            (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "rgba(139,158,176,0.6)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut size={15} strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}
