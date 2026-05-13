import { useCallback, useEffect, useState } from "react";
import {
  buscarAuditoria,
  type AuditoriaCliente,
  type AuditoriaResult,
  type StatusAuditoria,
} from "../services/api";

const STATUS_LABEL: Record<StatusAuditoria, string> = {
  enviado:             "Enviado",
  pendente_com_arquivo: "Pendente c/ arquivo",
  sem_arquivo:         "Sem documento",
  sem_email:           "Sem e-mail",
  erro:                "Erro",
};

const STATUS_ORDEM: Record<StatusAuditoria, number> = {
  pendente_com_arquivo: 0,
  erro:                 1,
  enviado:              2,
  sem_arquivo:          3,
  sem_email:            4,
};

type Filtro = StatusAuditoria | "todos";

function mesAtual(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: StatusAuditoria }) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 10px",
    borderRadius: "var(--radius-md)",
    fontSize: "var(--font-size-xs)",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };

  switch (status) {
    case "enviado":
      return <span style={{ ...style, background: "var(--color-teal)", color: "#fff" }}>✓ Enviado</span>;
    case "pendente_com_arquivo":
      return <span style={{ ...style, background: "#f59e0b", color: "#fff" }}>⚠ Pendente</span>;
    case "erro":
      return <span style={{ ...style, background: "var(--color-error-text)", color: "#fff" }}>✕ Erro</span>;
    case "sem_arquivo":
      return <span style={{ ...style, background: "var(--color-border)", color: "var(--color-text-muted)" }}>— Sem documento</span>;
    case "sem_email":
      return <span style={{ ...style, background: "#fee2e2", color: "var(--color-error-text)", border: "1px solid #fca5a5" }}>✕ Sem e-mail</span>;
  }
}

function exportarCSV(resultado: AuditoriaResult) {
  const STATUS_PT: Record<StatusAuditoria, string> = {
    enviado:             "Enviado",
    pendente_com_arquivo: "Pendente com arquivo",
    sem_arquivo:         "Sem documento",
    sem_email:           "Sem e-mail",
    erro:                "Erro",
  };

  const linhas = [
    ["Nome", "CNPJ", "E-mails", "Status", "Arquivos enviados", "Novos arquivos", "Data de envio", "Mensagem de erro"],
    ...resultado.clientes.map(c => [
      c.nome,
      c.cnpj ?? "",
      c.emails.join(" | "),
      STATUS_PT[c.status],
      c.arquivosEnviados.join(" | "),
      c.novosArquivos.join(" | "),
      formatarData(c.enviadoEm),
      c.mensagemErro ?? "",
    ]),
  ];

  const csv = linhas
    .map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `auditoria_${resultado.mes}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Auditoria() {
  const [mes, setMes]             = useState(mesAtual());
  const [resultado, setResultado] = useState<AuditoriaResult | null>(null);
  const [carregando, setCarreg]   = useState(false);
  const [erro, setErro]           = useState("");
  const [filtro, setFiltro]       = useState<Filtro>("todos");
  const [expandido, setExpandido] = useState<number | null>(null);

  const carregar = useCallback(() => {
    setCarreg(true);
    setErro("");
    buscarAuditoria(mes)
      .then(r => {
        setResultado(r);
        setFiltro("todos");
        setExpandido(null);
      })
      .catch(() => setErro("Não foi possível carregar a auditoria. Verifique a conexão com o backend."))
      .finally(() => setCarreg(false));
  }, [mes]);

  useEffect(() => { carregar(); }, [carregar]);

  const clientesFiltrados = resultado
    ? [...resultado.clientes]
        .filter(c => filtro === "todos" || c.status === filtro)
        .sort((a, b) => STATUS_ORDEM[a.status] - STATUS_ORDEM[b.status] || a.nome.localeCompare(b.nome))
    : [];

  const { resumo } = resultado ?? { resumo: null };

  const CARDS = resumo
    ? [
        { label: "Pendente c/ arquivo", valor: resumo.pendentesComArquivo, filtro: "pendente_com_arquivo" as Filtro, cor: "#f59e0b", urgente: resumo.pendentesComArquivo > 0 },
        { label: "Com erro",            valor: resumo.comErro,             filtro: "erro" as Filtro,                cor: "var(--color-error-text)", urgente: resumo.comErro > 0 },
        { label: "Enviados",            valor: resumo.enviados,            filtro: "enviado" as Filtro,             cor: "var(--color-teal)", urgente: false },
        { label: "Sem documento",       valor: resumo.semArquivo,          filtro: "sem_arquivo" as Filtro,         cor: "var(--color-text-muted)", urgente: false },
        { label: "Sem e-mail",          valor: resumo.semEmail,            filtro: "sem_email" as Filtro,           cor: "var(--color-error-text)", urgente: false },
      ]
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>

      {/* Cabeçalho */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <div>
          <h1 className="card__title" style={{ marginBottom: 4 }}>Auditoria de Envios</h1>
          <p style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", margin: 0 }}>
            Visão consolidada por mês: documentos enviados, pendentes e clientes sem documento.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <input
            type="month"
            className="form-input"
            value={mes}
            onChange={e => setMes(e.target.value)}
            style={{ width: 160 }}
          />
          <button className="btn btn--primary" onClick={carregar} disabled={carregando}>
            {carregando ? "Carregando..." : "Atualizar"}
          </button>
          {resultado && (
            <button className="btn btn--secondary" onClick={() => exportarCSV(resultado)} title="Exportar CSV">
              CSV ↓
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="alert alert--error">
          <div className="alert__title">Erro</div>{erro}
        </div>
      )}

      {/* Cards de resumo */}
      {resumo && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
          {CARDS.map(c => (
            <button
              key={c.filtro}
              type="button"
              onClick={() => setFiltro(filtro === c.filtro ? "todos" : c.filtro)}
              style={{
                cursor: "pointer",
                border: `2px solid ${filtro === c.filtro ? c.cor : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                background: filtro === c.filtro ? `${c.cor}15` : "var(--color-white)",
                textAlign: "center",
                transition: "all var(--transition)",
                boxShadow: c.urgente && c.valor > 0 ? `0 0 0 2px ${c.cor}40` : "none",
              }}
            >
              <div style={{ fontSize: "2rem", fontWeight: 800, color: c.cor, lineHeight: 1 }}>{c.valor}</div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>{c.label}</div>
            </button>
          ))}
          {/* Total */}
          <div style={{
            border: "2px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            background: "var(--color-bg)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--color-navy)", lineHeight: 1 }}>{resumo.total}</div>
            <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 4 }}>Total de clientes</div>
          </div>
        </div>
      )}

      {/* Aviso de pendências urgentes */}
      {resumo && resumo.pendentesComArquivo > 0 && (
        <div style={{
          background: "#fffbeb",
          border: "1.5px solid #f59e0b",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3) var(--space-4)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}>
          <span style={{ fontSize: "1.25rem" }}>⚠</span>
          <span style={{ fontSize: "var(--font-size-sm)", color: "#92400e" }}>
            <strong>{resumo.pendentesComArquivo} cliente{resumo.pendentesComArquivo > 1 ? "s" : ""}</strong> com documentos disponíveis que ainda não foram enviados este mês.
          </span>
          <button
            className="btn btn--secondary"
            style={{ marginLeft: "auto", fontSize: "var(--font-size-xs)", padding: "4px 12px", height: "auto" }}
            onClick={() => setFiltro("pendente_com_arquivo")}
          >
            Ver pendentes
          </button>
        </div>
      )}

      {/* Tabela */}
      {resultado && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Filtros */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            flexWrap: "wrap",
            gap: "var(--space-2)",
          }}>
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {(["todos", "pendente_com_arquivo", "erro", "enviado", "sem_arquivo", "sem_email"] as Filtro[]).map(f => {
                const count = f === "todos"
                  ? resultado.resumo.total
                  : resultado.clientes.filter(c => c.status === f).length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFiltro(f)}
                    style={{
                      padding: "4px 12px",
                      border: "1.5px solid",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--font-size-xs)",
                      fontWeight: filtro === f ? 700 : 500,
                      cursor: "pointer",
                      background: filtro === f ? "var(--color-navy)" : "var(--color-white)",
                      color: filtro === f ? "var(--color-white)" : "var(--color-text-muted)",
                      borderColor: filtro === f ? "var(--color-navy)" : "var(--color-border)",
                    }}
                  >
                    {f === "todos" ? "Todos" : STATUS_LABEL[f as StatusAuditoria]} ({count})
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
              {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? "s" : ""}
            </span>
          </div>

          {carregando ? (
            <p style={{ padding: "var(--space-6)", color: "var(--color-gray)" }}>Carregando...</p>
          ) : clientesFiltrados.length === 0 ? (
            <p style={{ padding: "var(--space-6)", color: "var(--color-gray)" }}>Nenhum cliente nesta categoria.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Cliente</th>
                  <th style={{ width: "22%" }}>E-mails</th>
                  <th>Arquivos</th>
                  <th style={{ textAlign: "center", width: 150 }}>Status</th>
                  <th style={{ width: 140 }}>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map(c => (
                  <>
                    <tr
                      key={c.id}
                      style={{ cursor: c.mensagemErro || c.novosArquivos.length > 0 ? "pointer" : "default" }}
                      onClick={() => setExpandido(expandido === c.id ? null : c.id)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--color-navy)" }}>{c.nome}</div>
                        {c.cnpj && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{c.cnpj}</div>
                        )}
                      </td>
                      <td>
                        {c.emails.length === 0 ? (
                          <span className="badge badge--error">Sem e-mail</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {c.emails.map(e => (
                              <span key={e} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{e}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <ArquivosCell cliente={c} />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <StatusBadge status={c.status} />
                        {c.novosArquivos.length > 0 && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "#f59e0b", marginTop: 3, fontWeight: 600 }}>
                            +{c.novosArquivos.length} novo{c.novosArquivos.length > 1 ? "s" : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                        {formatarData(c.enviadoEm)}
                      </td>
                    </tr>
                    {/* Linha expandida: erro ou novos arquivos */}
                    {expandido === c.id && (c.mensagemErro || c.novosArquivos.length > 0) && (
                      <tr key={`${c.id}-detalhe`}>
                        <td colSpan={5} style={{
                          background: "var(--color-bg)",
                          padding: "var(--space-3) var(--space-4)",
                          borderTop: "none",
                        }}>
                          {c.mensagemErro && (
                            <div style={{ marginBottom: c.novosArquivos.length > 0 ? "var(--space-3)" : 0 }}>
                              <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: "var(--color-error-text)" }}>Erro: </span>
                              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-error-text)" }}>{c.mensagemErro}</span>
                            </div>
                          )}
                          {c.novosArquivos.length > 0 && (
                            <div>
                              <span style={{ fontSize: "var(--font-size-xs)", fontWeight: 700, color: "#92400e" }}>Novos arquivos disponíveis: </span>
                              <span style={{ fontSize: "var(--font-size-xs)", color: "#92400e" }}>{c.novosArquivos.join(", ")}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Legenda */}
      {resultado && (
        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textAlign: "center" }}>
          Clique em linhas com erro ou novos arquivos para expandir detalhes.
        </p>
      )}
    </div>
  );
}

function ArquivosCell({ cliente: c }: { cliente: AuditoriaCliente }) {
  if (c.status === "enviado") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {c.arquivosEnviados.length === 0 ? (
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Sem registro de arquivos</span>
        ) : (
          c.arquivosEnviados.map(f => (
            <span key={f} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-teal)" }}>✓ {f}</span>
          ))
        )}
      </div>
    );
  }

  if (c.status === "pendente_com_arquivo") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {c.arquivosDisponiveis.map(f => (
          <span key={f} style={{ fontSize: "var(--font-size-xs)", color: "#92400e", fontWeight: 500 }}>📄 {f}</span>
        ))}
      </div>
    );
  }

  if (c.status === "erro" && c.arquivosDisponiveis.length > 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {c.arquivosDisponiveis.map(f => (
          <span key={f} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>📄 {f}</span>
        ))}
      </div>
    );
  }

  return <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-border)" }}>—</span>;
}
