import { useState } from "react";
import { Home } from "./pages/Home";
import { Clientes } from "./pages/Clientes";
import { Dashboard } from "./pages/Dashboard";
import { Configuracoes } from "./pages/Configuracoes";

type Pagina = "envio" | "clientes" | "dashboard" | "config";

const LABELS: Record<Pagina, string> = {
  envio:     "Envio",
  clientes:  "Clientes",
  dashboard: "Dashboard",
  config:    "Configurações",
};

export default function App() {
  const [pagina, setPagina] = useState<Pagina>("envio");

  return (
    <>
      <header className="header">
        <div className="header__logo">
          <div className="header__logo-mark">7</div>
          <div className="header__brand">
            <span className="header__name">Seven</span>
            <span className="header__sub">Sistemas de Automação</span>
          </div>
        </div>
        <nav className="header__nav">
          {(["envio", "clientes", "dashboard", "config"] as Pagina[]).map(p => (
            <button
              key={p}
              className={`nav-item${pagina === p ? " nav-item--active" : ""}`}
              onClick={() => setPagina(p)}
            >
              {LABELS[p]}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        <div style={{ display: pagina === "envio"     ? "block" : "none" }}><Home /></div>
        <div style={{ display: pagina === "clientes"  ? "block" : "none" }}><Clientes /></div>
        <div style={{ display: pagina === "dashboard" ? "block" : "none" }}><Dashboard /></div>
        <div style={{ display: pagina === "config"    ? "block" : "none" }}><Configuracoes /></div>
      </main>

      <footer className="footer">
        Seven Sistemas de Automação &mdash; Enviardocs
      </footer>
    </>
  );
}
