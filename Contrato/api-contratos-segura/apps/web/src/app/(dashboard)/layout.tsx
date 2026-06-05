"use client";

import { useState } from "react";
import { Sidebar } from "@/components/ui/Sidebar";
import { Menu, X } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="dashboard-layout">
      {/* Overlay escuro no mobile */}
      <div
        className={`sidebar-overlay${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Topbar mobile com hambúrguer */}
        <div className="mobile-topbar">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} color="#fff" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seven-vertical.png" alt="Seven" style={{ height: 28, background: "#fff", padding: "2px 4px", borderRadius: 6 }} />
            <div>
              <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "0.1em", margin: 0 }}>SEVEN</p>
              <p style={{ color: "rgba(139,158,176,0.6)", fontSize: "0.55rem", letterSpacing: "0.05em", margin: 0 }}>GESTÃO DE CONTRATOS</p>
            </div>
          </div>
          <button
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen && <X size={20} color="rgba(255,255,255,0.7)" />}
          </button>
        </div>

        <main className="dashboard-main" style={{ padding: "1.25rem" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
