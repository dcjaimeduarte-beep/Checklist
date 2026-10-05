import { Fragment, useEffect, useRef, useState } from "react";
import { buscarStatus, type Status } from "../services/api";

const MES_ATUAL = new Date().toISOString().slice(0, 7);

export function Dashboard() {
  const [mes, setMes]           = useState(MES_ATUAL);
  const [status, setStatus]     = useState<Status | null>(null);
  const [erro, setErro]         = useState("");
  const [carregando, setCarreg] = useState(true);
  const [aberto, setAberto]     = useState<number | null>(null);
  const [busca, setBusca]       = useState("");
  const recarregouLista = useRef(false);

  function carregar(mesFiltro: string) {
    setCarreg(true);
    setErro("");
    buscarStatus(mesFiltro)
      .then(setStatus)
      .catch(() => setErro("Não foi possível carregar o status do sistema."))
      .finally(() => setCarreg(false));
  }

  useEffect(() => { carregar(mes); }, [mes]);

  const termo = busca.trim().toLowerCase();
  const enviosFiltrados = (status?.ultimosEnvios ?? []).filter(e =>
    !termo || e.cliente.toLowerCase().includes(termo)
  );

  useEffect(() => {
    if (!status || recarregouLista.current) return;
    const semLista = status.ultimosEnvios.some(e => e.files_count > 0 && !Array.isArray(e.arquivos));
    if (!semLista) return;
    recarregouLista.current = true;
    carregar(mes);
  }, [status, mes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>
        <h1 className="card__title" style={{ marginBottom: 0 }}>Dashboard</h1>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Mês de referência</label>
          <input
            type="month"
            className="form-input"
            style={{ width: 180 }}
            value={mes}
            onChange={e => { setMes(e.target.value); setAberto(null); setBusca(""); recarregouLista.current = false; }}
          />
        </div>
      </div>

      {erro && (
        <div className="alert alert--error">
          <div className="alert__title">Erro</div>{erro}
        </div>
      )}

      {carregando ? (
        <p style={{ color: "var(--color-gray)" }}>Carregando...</p>
      ) : status && (
        <>
          {/* Cartões gerais */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--color-teal)" }}>
                {status.totalClientes}
              </div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                Clientes ativos
              </div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "2.25rem", fontWeight: 700, color: status.semEmail > 0 ? "var(--color-error-text)" : "var(--color-teal)" }}>
                {status.semEmail}
              </div>
              <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                Sem e-mail
              </div>
            </div>

            {/* Resumo do mês */}
            {status.resumoMes && (
              <>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--color-teal)" }}>
                    {status.resumoMes.enviados}
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    Enviados em {mes}
                  </div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2.25rem", fontWeight: 700, color: status.resumoMes.erros > 0 ? "var(--color-error-text)" : "var(--color-teal)" }}>
                    {status.resumoMes.erros}
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    Erros em {mes}
                  </div>
                </div>
                <div className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "2.25rem", fontWeight: 700, color: "var(--color-navy)" }}>
                    {status.resumoMes.arquivos}
                  </div>
                  <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                    Arquivos enviados
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Pasta de documentos */}
          <div className="card">
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-navy)", marginBottom: "var(--space-3)" }}>
              Pasta de documentos
            </div>
            <div style={{
              background: "var(--color-bg)",
              border: "1.5px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              fontFamily: "monospace",
              fontSize: "var(--font-size-sm)",
              color: "var(--color-navy)",
              wordBreak: "break-all",
            }}>
              {status.storageDir}
            </div>
            <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
              Estrutura esperada: <code>{status.storageDir}\AAAA-MM\arquivos.pdf</code> — altere via <code>STORAGE_DIR</code> no <code>backend/.env</code>.
            </p>
          </div>

          {/* Histórico do mês */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
              <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-navy)" }}>
                {status.resumoMes
                  ? `Histórico de envios — ${mes} (${enviosFiltrados.length} registro${enviosFiltrados.length !== 1 ? "s" : ""})`
                  : `Últimos 50 envios`}
              </div>
              <input
                type="search"
                className="form-input"
                placeholder="Buscar por nome..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: 260, height: 36 }}
              />
            </div>

            {status.ultimosEnvios.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Nenhum envio registrado {status.resumoMes ? `em ${mes}` : "ainda"}.
              </p>
            ) : enviosFiltrados.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Nenhum envio com esse nome.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Mês</th>
                      <th style={{ textAlign: "center" }}>Arquivos</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                      <th>Data</th>
                      <th>Detalhe do erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enviosFiltrados.map((e) => {
                      const abertoEste = aberto === e.id;
                      const arquivos = e.arquivos ?? [];
                      const emails = e.emails ?? [];
                      return (
                        <Fragment key={e.id}>
                          <tr
                            onClick={() => setAberto(abertoEste ? null : e.id)}
                            style={{
                              cursor: "pointer",
                              background: abertoEste
                                ? "var(--color-bg)"
                                : e.status === "error" ? "var(--color-error-bg)" : undefined,
                            }}
                          >
                            <td style={{ fontWeight: 500 }}>{e.cliente}</td>
                            <td style={{ color: "var(--color-text-muted)" }}>{e.month}</td>
                            <td style={{ textAlign: "center" }}>{e.files_count}</td>
                            <td style={{ textAlign: "center" }}>
                              <span className={`badge badge--${e.status === "success" ? "success" : e.status === "error" ? "error" : "neutral"}`}>
                                {e.status === "success" ? "Enviado" : e.status === "error" ? "Erro" : "Ignorado"}
                              </span>
                            </td>
                            <td style={{ whiteSpace: "nowrap", color: "var(--color-text-muted)", fontSize: "var(--font-size-xs)" }}>
                              {new Date(e.sent_at).toLocaleString("pt-BR")}
                            </td>
                            <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-error-text)", maxWidth: 260 }}>
                              {e.status === "error" && e.error_message && (
                                <span title={e.error_message}>
                                  ⚠ {e.error_message.length > 80 ? e.error_message.slice(0, 80) + "…" : e.error_message}
                                </span>
                              )}
                            </td>
                          </tr>
                          {abertoEste && (
                            <tr>
                              <td colSpan={6} style={{ background: "var(--color-bg)", padding: "var(--space-3) var(--space-4)" }}>
                                <div style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: "var(--color-navy)", marginBottom: "var(--space-2)" }}>
                                  Documentos anexados
                                </div>
                                {arquivos.length === 0 ? (
                                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                                    Este envio não guardou o nome dos arquivos.
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {arquivos.map(nome => (
                                      <div key={nome} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text)" }}>
                                        {nome}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {emails.length > 0 && (
                                  <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-3)" }}>
                                    Enviado para {emails.join(", ")}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
