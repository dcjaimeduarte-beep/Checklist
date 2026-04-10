import { useState } from "react";
import { Home } from "./pages/Home";
import { Clientes } from "./pages/Clientes";
import { Dashboard } from "./pages/Dashboard";

type Pagina = "envio" | "clientes" | "dashboard";

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
          {(["envio", "clientes", "dashboard"] as Pagina[]).map(p => (
            <button
              key={p}
              className={`nav-item${pagina === p ? " nav-item--active" : ""}`}
              onClick={() => setPagina(p)}
            >
              {p === "envio" ? "Envio" : p === "clientes" ? "Clientes" : "Dashboard"}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {pagina === "envio"     && <Home />}
        {pagina === "clientes"  && <Clientes />}
        {pagina === "dashboard" && <Dashboard />}
      </main>

      <footer className="footer">
        Seven Sistemas de Automação &mdash; Enviardocs
      </footer>
    </>
  );
}
