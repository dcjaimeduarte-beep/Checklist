import React, { useEffect, useState, useCallback } from "react";
import {
  listarClientes,
  buscarClientePorNome,
  atualizarCliente,
  criarCliente,
  desativarCliente,
  type Cliente,
  type ClienteInput,
} from "../services/api";

const TIPO_ENVIO_OPTS = ["email", "boleto", "pix", "whatsapp", "recibo"];
const SECAO_OPTS      = ["nota_fiscal", "boleto"];
const VAZIO: ClienteInput = {
  nome: "", cnpj: "", nomeContato: "", telefone: "",
  tipoEnvio: "email", regime: "", secao: "nota_fiscal",
  nomePasta: "", observacoes: "", emails: [],
};

const POR_PAGINA_OPTS = [10, 25, 50, 0] as const; // 0 = todos
type PorPagina = typeof POR_PAGINA_OPTS[number];

export function Clientes() {
  const [clientes, setClientes]     = useState<Cliente[]>([]);
  const [busca, setBusca]           = useState("");
  const [carregando, setCarreg]     = useState(true);
  const [modal, setModal]           = useState<Cliente | "novo" | null>(null);
  const [form, setForm]             = useState<ClienteInput>(VAZIO);
  const [novoEmail, setNovoEmail]   = useState("");
  const [salvando, setSalvando]     = useState(false);
  const [erro, setErro]             = useState("");
  const [confirmarId, setConfirm]   = useState<number | null>(null);
  const [pagina, setPagina]         = useState(1);
  const [porPagina, setPorPagina]   = useState<PorPagina>(10);

  const carregar = useCallback(() => {
    setCarreg(true);
    listarClientes()
      .then(setClientes)
      .catch(() => setErro("Não foi possível carregar os clientes."))
      .finally(() => setCarreg(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    setPagina(1); // volta para a primeira página ao buscar
    if (busca.length < 2) { carregar(); return; }
    const t = setTimeout(() => {
      buscarClientePorNome(busca).then(setClientes).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [busca, carregar]);

  // Paginação
  const totalPaginas = porPagina === 0 ? 1 : Math.ceil(clientes.length / porPagina);
  const clientesPagina = porPagina === 0
    ? clientes
    : clientes.slice((pagina - 1) * porPagina, pagina * porPagina);

  function abrirNovo() {
    setForm(VAZIO);
    setNovoEmail("");
    setErro("");
    setModal("novo");
  }

  function abrirEditar(c: Cliente) {
    setForm({
      nome: c.nome, cnpj: c.cnpj ?? "", nomeContato: c.nomeContato ?? "",
      telefone: c.telefone ?? "", tipoEnvio: c.tipoEnvio, regime: c.regime ?? "",
      secao: c.secao, nomePasta: c.nomePasta ?? "", observacoes: c.observacoes ?? "",
      emails: [...c.emails],
    });
    setNovoEmail("");
    setErro("");
    setModal(c);
  }

  function fecharModal() { setModal(null); setErro(""); }

  function campo(key: keyof ClienteInput, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function adicionarEmail() {
    const e = novoEmail.trim().toLowerCase();
    if (!e || !e.includes("@")) return;
    if ((form.emails ?? []).includes(e)) return;
    setForm(f => ({ ...f, emails: [...(f.emails ?? []), e] }));
    setNovoEmail("");
  }

  function removerEmail(email: string) {
    setForm(f => ({ ...f, emails: (f.emails ?? []).filter(x => x !== email) }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (modal === "novo") {
        await criarCliente(form);
      } else if (modal) {
        await atualizarCliente(modal.id, form);
      }
      fecharModal();
      carregar();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } })
        ?.response?.data?.erro ?? "Erro ao salvar.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarDesativar() {
    if (!confirmarId) return;
    try {
      await desativarCliente(confirmarId);
      setConfirm(null);
      carregar();
    } catch {
      setErro("Erro ao desativar cliente.");
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <h1 className="card__title" style={{ marginBottom: 0 }}>Clientes</h1>
          <button className="btn btn--primary" onClick={abrirNovo}>+ Novo cliente</button>
        </div>

        {/* Busca */}
        <div className="card" style={{ padding: "var(--space-4)" }}>
          <input
            className="form-input"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        {/* Tabela */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Barra de controles */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "var(--space-3) var(--space-4)",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-bg)",
            flexWrap: "wrap", gap: "var(--space-3)",
          }}>
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
              {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} encontrado{clientes.length !== 1 ? "s" : ""}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>Mostrar:</span>
              {POR_PAGINA_OPTS.map(op => (
                <button
                  key={op}
                  type="button"
                  onClick={() => { setPorPagina(op); setPagina(1); }}
                  style={{
                    padding: "4px 10px",
                    border: "1.5px solid",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    background: porPagina === op ? "var(--color-teal)" : "var(--color-white)",
                    color: porPagina === op ? "var(--color-white)" : "var(--color-navy)",
                    borderColor: porPagina === op ? "var(--color-teal)" : "var(--color-border)",
                    transition: "all var(--transition)",
                  }}
                >
                  {op === 0 ? "Todos" : op}
                </button>
              ))}
            </div>
          </div>

          {carregando ? (
            <p style={{ padding: "var(--space-6)", color: "var(--color-gray)" }}>Carregando...</p>
          ) : clientes.length === 0 ? (
            <p style={{ padding: "var(--space-6)", color: "var(--color-gray)" }}>Nenhum cliente encontrado.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Nome / Contato</th>
                  <th>E-mails</th>
                  <th style={{ textAlign: "center", width: 90 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesPagina.map(c => (
                  <tr
                    key={c.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => abrirEditar(c)}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--color-navy)", marginBottom: 2 }}>{c.nome}</div>
                      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginTop: 4 }}>
                        {c.nomeContato && (
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                            👤 {c.nomeContato}
                          </span>
                        )}
                        {c.cnpj && (
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                            {c.cnpj}
                          </span>
                        )}
                        <span className="badge badge--neutral" style={{ fontSize: "var(--font-size-xs)" }}>{c.tipoEnvio}</span>
                        <span className="badge badge--neutral" style={{ fontSize: "var(--font-size-xs)" }}>{c.secao}</span>
                      </div>
                    </td>
                    <td>
                      {c.emails.length === 0 ? (
                        <span className="badge badge--error">Sem e-mail</span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {c.emails.map((em, i) => (
                            <span key={em} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                              {i === 0 && <span style={{ color: "var(--color-teal)", fontWeight: 600, marginRight: 4 }}>✦</span>}
                              {em}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "center" }}>
                        <button
                          title="Editar cliente"
                          className="icon-btn icon-btn--edit"
                          onClick={() => abrirEditar(c)}
                        >
                          ✎
                        </button>
                        <button
                          title="Remover cliente"
                          className="icon-btn icon-btn--delete"
                          onClick={() => setConfirm(c.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Paginação */}
          {!carregando && clientes.length > 0 && porPagina !== 0 && totalPaginas > 1 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: "var(--space-2)", padding: "var(--space-4)",
              borderTop: "1px solid var(--color-border)",
            }}>
              <button
                className="icon-btn"
                onClick={() => setPagina(1)}
                disabled={pagina === 1}
                title="Primeira página"
                style={{ fontSize: "var(--font-size-xs)", width: "auto", padding: "4px 8px" }}
              >«</button>
              <button
                className="icon-btn"
                onClick={() => setPagina(p => Math.max(1, p - 1))}
                disabled={pagina === 1}
                title="Página anterior"
                style={{ fontSize: "var(--font-size-xs)", width: "auto", padding: "4px 8px" }}
              >‹</button>

              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 2)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`sep-${idx}`} style={{ color: "var(--color-text-muted)", padding: "0 4px" }}>…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPagina(item as number)}
                      style={{
                        width: 32, height: 32,
                        border: "1.5px solid",
                        borderRadius: "var(--radius-md)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 600,
                        cursor: "pointer",
                        background: pagina === item ? "var(--color-teal)" : "var(--color-white)",
                        color: pagina === item ? "var(--color-white)" : "var(--color-navy)",
                        borderColor: pagina === item ? "var(--color-teal)" : "var(--color-border)",
                      }}
                    >{item}</button>
                  )
                )
              }

              <button
                className="icon-btn"
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                title="Próxima página"
                style={{ fontSize: "var(--font-size-xs)", width: "auto", padding: "4px 8px" }}
              >›</button>
              <button
                className="icon-btn"
                onClick={() => setPagina(totalPaginas)}
                disabled={pagina === totalPaginas}
                title="Última página"
                style={{ fontSize: "var(--font-size-xs)", width: "auto", padding: "4px 8px" }}
              >»</button>

              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginLeft: "var(--space-2)" }}>
                Página {pagina} de {totalPaginas}
              </span>
            </div>
          )}
        </div>

        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", textAlign: "center" }}>
          Clique em qualquer linha para editar o cadastro
        </p>
      </div>

      {/* Modal editar / criar */}
      {modal !== null && (
        <div className="modal-backdrop" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">{modal === "novo" ? "Novo cliente" : "Editar cliente"}</span>
              <button className="modal__close" onClick={fecharModal}>✕</button>
            </div>

            <form className="modal__body" onSubmit={salvar}>
              {/* Seção: Dados gerais */}
              <p className="section-label">Dados gerais</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Nome *</label>
                  <input className="form-input" required value={form.nome} onChange={e => campo("nome", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">CNPJ</label>
                  <input className="form-input" value={form.cnpj ?? ""} onChange={e => campo("cnpj", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nome do contato</label>
                  <input className="form-input" value={form.nomeContato ?? ""} onChange={e => campo("nomeContato", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input className="form-input" value={form.telefone ?? ""} onChange={e => campo("telefone", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Regime</label>
                  <input className="form-input" value={form.regime ?? ""} onChange={e => campo("regime", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de envio</label>
                  <select className="form-input" value={form.tipoEnvio} onChange={e => campo("tipoEnvio", e.target.value)}>
                    {TIPO_ENVIO_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Seção</label>
                  <select className="form-input" value={form.secao} onChange={e => campo("secao", e.target.value)}>
                    {SECAO_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">
                    Nome da pasta
                    <span style={{ fontWeight: 400, color: "var(--color-text-muted)", marginLeft: 6 }}>(se diferente do nome)</span>
                  </label>
                  <input className="form-input" placeholder={form.nome || "mesmo que o nome do cliente"} value={form.nomePasta ?? ""} onChange={e => campo("nomePasta", e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                  <label className="form-label">Observações</label>
                  <textarea className="form-input" rows={2} value={form.observacoes ?? ""} onChange={e => campo("observacoes", e.target.value)} style={{ resize: "vertical" }} />
                </div>
              </div>

              {/* Seção: E-mails */}
              <div className="divider" style={{ margin: "var(--space-2) 0" }} />
              <p className="section-label">E-mails para envio</p>

              {(form.emails ?? []).length === 0 && (
                <div className="alert alert--error" style={{ padding: "var(--space-3) var(--space-4)" }}>
                  Nenhum e-mail cadastrado — este cliente não poderá receber documentos.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                {(form.emails ?? []).map((em, i) => (
                  <div key={em} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <div style={{
                      flex: 1, padding: "8px 12px",
                      background: "var(--color-bg)",
                      border: "1.5px solid var(--color-border)",
                      borderRadius: "var(--radius-md)",
                      fontSize: "var(--font-size-sm)",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <span>{em}</span>
                      {i === 0 && (
                        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-teal)", fontWeight: 600, marginLeft: 8 }}>
                          principal
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      title="Remover e-mail"
                      className="icon-btn icon-btn--delete"
                      onClick={() => removerEmail(em)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <input
                  className="form-input"
                  type="email"
                  placeholder="novo@email.com.br"
                  value={novoEmail}
                  onChange={e => setNovoEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); adicionarEmail(); } }}
                />
                <button type="button" className="btn btn--secondary" style={{ whiteSpace: "nowrap" }} onClick={adicionarEmail}>
                  + Adicionar
                </button>
              </div>

              {erro && (
                <div className="alert alert--error">
                  <div className="alert__title">Erro</div>{erro}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
                <button type="button" className="btn btn--secondary" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn btn--primary" disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmação de remoção */}
      {confirmarId !== null && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <span className="modal__title">Remover cliente</span>
              <button className="modal__close" onClick={() => setConfirm(null)}>✕</button>
            </div>
            <div className="modal__body">
              <p>Tem certeza que deseja remover este cliente? A ação não poderá ser desfeita pela interface.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", paddingTop: "var(--space-2)" }}>
                <button className="btn btn--secondary" onClick={() => setConfirm(null)}>Cancelar</button>
                <button
                  className="btn"
                  style={{ background: "var(--color-error-text)", color: "#fff", borderColor: "var(--color-error-text)" }}
                  onClick={confirmarDesativar}
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
