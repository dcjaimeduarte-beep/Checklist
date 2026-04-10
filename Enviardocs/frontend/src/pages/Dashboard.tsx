import { useEffect, useState } from "react";
import { buscarStatus, type Status } from "../services/api";

const MES_ATUAL = new Date().toISOString().slice(0, 7);

export function Dashboard() {
  const [mes, setMes]           = useState(MES_ATUAL);
  const [status, setStatus]     = useState<Status | null>(null);
  const [erro, setErro]         = useState("");
  const [carregando, setCarreg] = useState(true);

  function carregar(mesFiltro: string) {
    setCarreg(true);
    setErro("");
    buscarStatus(mesFiltro)
      .then(setStatus)
      .catch(() => setErro("Não foi possível carregar o status do sistema."))
      .finally(() => setCarreg(false));
  }

  useEffect(() => { carregar(mes); }, [mes]);

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
            onChange={e => setMes(e.target.value)}
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
            <div style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-navy)", marginBottom: "var(--space-4)" }}>
              {status.resumoMes
                ? `Histórico de envios — ${mes} (${status.ultimosEnvios.length} registro${status.ultimosEnvios.length !== 1 ? "s" : ""})`
                : `Últimos 50 envios`}
            </div>

            {status.ultimosEnvios.length === 0 ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
                Nenhum envio registrado {status.resumoMes ? `em ${mes}` : "ainda"}.
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
                    {status.ultimosEnvios.map((e) => (
                      <tr key={e.id} style={{ background: e.status === "error" ? "var(--color-error-bg)" : undefined }}>
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
                    ))}
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
