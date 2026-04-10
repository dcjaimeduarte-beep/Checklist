import React, { useRef, useState } from "react";
import { listarClientes, type Cliente } from "../services/api";
import { api } from "../services/api";

const MES_ATUAL = new Date().toISOString().slice(0, 7);

const EXTENSOES = new Set(["pdf", "xml", "xlsx", "docx", "csv", "zip"]);

// Mesma lógica do backend: normaliza nome removendo acentos, caracteres especiais
function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

interface PreviewItem {
  cliente: Cliente;
  arquivos: File[];
  status: "ok" | "sem_arquivo" | "sem_email";
}

interface ResultadoEnvio {
  clienteId: number;
  nome: string;
  status: "ok" | "erro";
  arquivos?: number;
  destinatarios?: string[];
  mensagem?: string;
}

type Filtro = "com_arquivo" | "sem_arquivo" | "sem_email" | "todos";

export function Home() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [mes, setMes]                   = useState(MES_ATUAL);
  const [pastaNome, setPastaNome]       = useState("");
  const [preview, setPreview]           = useState<PreviewItem[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [filtro, setFiltro]             = useState<Filtro>("com_arquivo");
  const [enviando, setEnviando]         = useState(false);
  const [resultados, setResultados]     = useState<ResultadoEnvio[] | null>(null);
  const [erro, setErro]                 = useState("");
  const [carregando, setCarregando]     = useState(false);

  // ── Selecionar pasta via browser ──────────────────────────────────────────

  async function handlePastaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setErro("");
    setResultados(null);
    setCarregando(true);

    // Nome da pasta: pega o caminho relativo do primeiro arquivo e extrai a pasta raiz
    const relative = files[0].webkitRelativePath;
    const raiz = relative.split("/")[0];
    setPastaNome(raiz);

    // Filtra apenas extensões permitidas (na raiz ou subpastas)
    const arquivosValidos = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return EXTENSOES.has(ext);
    });

    try {
      // Busca todos os clientes ativos para cruzamento
      const clientes = await listarClientes();

      const itens: PreviewItem[] = clientes.map(cliente => {
        if (cliente.emails.length === 0) {
          return { cliente, arquivos: [], status: "sem_email" as const };
        }
        const nomePasta = (cliente.nomePasta || cliente.nome) as string;
        const clienteNorm = normalizarNome(nomePasta);

        const matched = arquivosValidos.filter(f => {
          const base = f.name.replace(/\.[^.]+$/, "");
          return normalizarNome(base).includes(clienteNorm);
        });

        return {
          cliente,
          arquivos: matched,
          status: matched.length > 0 ? ("ok" as const) : ("sem_arquivo" as const),
        };
      });

      const comArquivo = new Set(
        itens.filter(i => i.status === "ok").map(i => i.cliente.id)
      );

      setPreview(itens);
      setSelecionados(comArquivo);
      setFiltro("com_arquivo");
    } catch {
      setErro("Não foi possível carregar a lista de clientes.");
    } finally {
      setCarregando(false);
    }
  }

  // ── Seleção ───────────────────────────────────────────────────────────────

  const itensFiltrados = (preview ?? []).filter(item => {
    if (filtro === "com_arquivo")  return item.status === "ok";
    if (filtro === "sem_arquivo")  return item.status === "sem_arquivo";
    if (filtro === "sem_email")    return item.status === "sem_email";
    return true;
  });

  const selecionaveisVisiveis = itensFiltrados
    .filter(i => i.status === "ok")
    .map(i => i.cliente.id);

  const todosMarcados =
    selecionaveisVisiveis.length > 0 &&
    selecionaveisVisiveis.every(id => selecionados.has(id));

  function toggleTodos() {
    const novo = new Set(selecionados);
    if (todosMarcados) {
      selecionaveisVisiveis.forEach(id => novo.delete(id));
    } else {
      selecionaveisVisiveis.forEach(id => novo.add(id));
    }
    setSelecionados(novo);
  }

  function toggleCliente(id: number) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  }

  // ── Envio ─────────────────────────────────────────────────────────────────

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || selecionados.size === 0) return;

    setEnviando(true);
    setErro("");

    const itensSelecionados = preview.filter(i => selecionados.has(i.cliente.id));

    // Mapeamento: clienteId → lista de nomes de arquivo
    const mapeamento = itensSelecionados.map(item => ({
      clienteId: item.cliente.id,
      arquivos:  item.arquivos.map(f => f.name),
    }));

    // Coleta todos os arquivos únicos necessários
    const arquivosNecessarios = new Map<string, File>();
    for (const item of itensSelecionados) {
      for (const f of item.arquivos) {
        arquivosNecessarios.set(f.name, f);
      }
    }

    const formData = new FormData();
    formData.append("mes", mes);
    formData.append("mapeamento", JSON.stringify(mapeamento));
    for (const [, file] of arquivosNecessarios) {
      formData.append("arquivos", file, file.name);
    }

    try {
      const { data } = await api.post<{
        mes: string;
        total: number;
        enviados: number;
        erros: number;
        resultados: ResultadoEnvio[];
      }>("/envios/lote-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120_000,
      });

      setResultados(data.resultados);
      setSelecionados(new Set());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } })
        ?.response?.data?.erro ?? "Erro ao enviar documentos.";
      setErro(msg);
    } finally {
      setEnviando(false);
    }
  }

  const resumo = preview
    ? {
        ok:         preview.filter(i => i.status === "ok").length,
        semArquivo: preview.filter(i => i.status === "sem_arquivo").length,
        semEmail:   preview.filter(i => i.status === "sem_email").length,
        total:      preview.length,
      }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 960, margin: "0 auto" }}>

      <div>
        <h1 className="card__title">Envio de Documentos</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Selecione a pasta com os arquivos do mês. O sistema identifica automaticamente quais arquivos pertencem a cada cliente.
        </p>
      </div>

      {/* Painel de seleção */}
      <div className="card">
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "0 0 auto" }}>
            <label className="form-label" htmlFor="mes">Mês de referência</label>
            <input
              id="mes"
              type="month"
              className="form-input"
              style={{ width: 180 }}
              value={mes}
              onChange={e => { setMes(e.target.value); setPreview(null); setResultados(null); }}
              disabled={enviando}
            />
          </div>

          {/* Input de pasta oculto — ativado pelo botão */}
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory não está nos tipos padrão
            webkitdirectory="true"
            multiple
            style={{ display: "none" }}
            onChange={handlePastaChange}
            disabled={enviando}
          />

          <button
            className="btn btn--primary"
            style={{ height: 42 }}
            onClick={() => { inputRef.current?.click(); }}
            disabled={enviando || carregando}
          >
            {carregando ? "Lendo arquivos..." : "Procurar pasta"}
          </button>

          {pastaNome && !carregando && (
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", alignSelf: "center" }}>
              📁 {pastaNome}
            </span>
          )}
        </div>

        {erro && (
          <div className="alert alert--error" style={{ marginTop: "var(--space-4)" }}>
            <div className="alert__title">Erro</div>{erro}
          </div>
        )}
      </div>

      {/* Preview dos clientes x arquivos */}
      {resumo && preview && !resultados && (
        <form onSubmit={handleEnviar} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Cartões de resumo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-3)" }}>
            {([
              { label: "Com arquivos", valor: resumo.ok,         cor: "var(--color-teal)",       f: "com_arquivo" as Filtro },
              { label: "Sem arquivo",  valor: resumo.semArquivo,  cor: "var(--color-text-muted)", f: "sem_arquivo" as Filtro },
              { label: "Sem e-mail",   valor: resumo.semEmail,    cor: "var(--color-error-text)", f: "sem_email"   as Filtro },
              { label: "Total",        valor: resumo.total,       cor: "var(--color-navy)",       f: "todos"       as Filtro },
            ] as const).map(c => (
              <button
                key={c.f}
                type="button"
                onClick={() => setFiltro(c.f)}
                className="card"
                style={{
                  textAlign: "center", cursor: "pointer", padding: "var(--space-4)",
                  outline: filtro === c.f ? `2px solid ${c.cor}` : "none",
                  outlineOffset: 2,
                }}
              >
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.cor }}>{c.valor}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>

          {/* Tabela */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Barra superior */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              gap: "var(--space-3)", flexWrap: "wrap",
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={toggleTodos}
                  disabled={selecionaveisVisiveis.length === 0}
                  style={{ width: 16, height: 16, accentColor: "var(--color-teal)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                  {selecionados.size === 0
                    ? "Selecionar todos"
                    : `${selecionados.size} selecionado${selecionados.size !== 1 ? "s" : ""}`}
                </span>
              </label>

              <button
                type="submit"
                className="btn btn--primary"
                disabled={selecionados.size === 0 || enviando}
              >
                {enviando
                  ? "Enviando..."
                  : `Enviar para ${selecionados.size} cliente${selecionados.size !== 1 ? "s" : ""}`}
              </button>
            </div>

            {itensFiltrados.length === 0 ? (
              <p style={{ padding: "var(--space-6)", color: "var(--color-gray)", textAlign: "center" }}>
                Nenhum cliente nesta categoria.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Cliente</th>
                    <th>Arquivos encontrados</th>
                    <th style={{ width: 110, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map(item => (
                    <tr
                      key={item.cliente.id}
                      style={{
                        cursor: item.status === "ok" ? "pointer" : "default",
                        opacity: item.status !== "ok" ? 0.55 : 1,
                      }}
                      onClick={() => item.status === "ok" && toggleCliente(item.cliente.id)}
                    >
                      <td style={{ textAlign: "center" }}>
                        {item.status === "ok" && (
                          <input
                            type="checkbox"
                            checked={selecionados.has(item.cliente.id)}
                            onChange={() => toggleCliente(item.cliente.id)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: 16, height: 16, accentColor: "var(--color-teal)", cursor: "pointer" }}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.cliente.nome}</div>
                        {item.cliente.emails.length > 0 && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                            {item.cliente.emails.join(", ")}
                          </div>
                        )}
                      </td>
                      <td>
                        {item.arquivos.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {item.arquivos.map(f => (
                              <span key={f.name} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                                📎 {f.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {item.status === "ok"          && <span className="badge badge--success">Pronto</span>}
                        {item.status === "sem_arquivo"  && <span className="badge badge--neutral">Sem arquivo</span>}
                        {item.status === "sem_email"    && <span className="badge badge--error">Sem e-mail</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </form>
      )}

      {/* Resultado do envio */}
      {resultados && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-navy)" }}>
              Resultado do envio
            </h2>
            <button className="btn btn--secondary" onClick={() => { setResultados(null); setPreview(null); setPastaNome(""); if (inputRef.current) inputRef.current.value = ""; }}>
              Novo envio
            </button>
          </div>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--color-teal)" }}>
                {resultados.filter(r => r.status === "ok").length}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Enviados</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: resultados.some(r => r.status === "erro") ? "var(--color-error-text)" : "var(--color-teal)" }}>
                {resultados.filter(r => r.status === "erro").length}
              </div>
              <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>Erros</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Destinatários</th>
                  <th style={{ textAlign: "center" }}>Arquivos</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(r => (
                  <tr key={r.clienteId}>
                    <td style={{ fontWeight: 500 }}>{r.nome}</td>
                    <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                      {r.destinatarios?.join(", ") ?? r.mensagem ?? "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>{r.arquivos ?? "—"}</td>
                    <td style={{ textAlign: "center" }}>
                      {r.status === "ok"
                        ? <span className="badge badge--success">Enviado</span>
                        : <span className="badge badge--error" title={r.mensagem}>Erro</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
