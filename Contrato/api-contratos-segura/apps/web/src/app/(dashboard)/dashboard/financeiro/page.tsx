"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, isApiError } from "@/lib/api";
import {
  RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Search, Calendar, Settings, X,
  FolderOpen, HardDrive, Folder, Database, ChevronUp,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FbConfigSource = "saved" | "env" | "none";

type FbStatus = { connected: boolean; database?: string; message?: string; source?: FbConfigSource };

type FbConfig = {
  host: string; port: number; database: string;
  user: string; passwordSet: boolean;
  source?: FbConfigSource;
  tabelaFinanceiro: string; campoCliente: string;
  campoVencimento: string; campoDtLiquidacao: string; campoVlLiquidado: string;
};

type ClientePreview = { cdCliente: number; cliente: string; cnpj: string };
type ClientesPreviewResponse = { total: number; items: ClientePreview[] };
type FdbSugestao = { path: string; name: string };

// ─── Browser de arquivos ──────────────────────────────────────────────────────

type BrowseItem = { name: string; fullPath: string; type: "drive" | "dir" | "fdb" };
type BrowseResult = { current: string; parent: string | null; items: BrowseItem[] };

function FileBrowser({ onSelect, onClose }: { onSelect: (path: string) => void; onClose: () => void }) {
  const [result,  setResult]  = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro,    setErro]    = useState("");

  const navigate = useCallback(async (p?: string) => {
    setLoading(true); setErro("");
    try {
      const url = p ? `/config/browse?path=${encodeURIComponent(p)}` : "/config/browse";
      const r = await apiFetch<BrowseResult>(url);
      setResult(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao navegar.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { navigate(); }, [navigate]);

  const iconFor = (type: BrowseItem["type"]) => {
    if (type === "drive") return <HardDrive size={15} style={{ color: "#0D2235", flexShrink: 0 }} />;
    if (type === "fdb")   return <Database  size={15} style={{ color: "#1B7A8C", flexShrink: 0 }} />;
    return                       <Folder    size={15} style={{ color: "#B07A00", flexShrink: 0 }} />;
  };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} style={{ zIndex: 60 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 480, maxHeight: "70vh", background: "#fff", borderRadius: 12,
        boxShadow: "0 8px 40px rgba(13,34,53,0.2)", zIndex: 61,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "linear-gradient(135deg,#0D2235,#1A3548)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <FolderOpen size={16} style={{ color: "#1B7A8C" }} />
            <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.9375rem", margin: 0 }}>Selecionar banco de dados</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {/* Barra de endereço */}
        <div style={{ padding: "0.625rem 1rem", background: "#F7FAFB", borderBottom: "1px solid #E8EEF3", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => result?.parent && navigate(result.parent)}
            disabled={!result?.parent}
            style={{ background: "none", border: "1px solid #D8E3EA", borderRadius: 6, padding: "3px 7px", cursor: result?.parent ? "pointer" : "not-allowed", opacity: result?.parent ? 1 : 0.4, display: "flex", alignItems: "center" }}
          >
            <ChevronUp size={14} style={{ color: "#0D2235" }} />
          </button>
          <code style={{ flex: 1, fontSize: "0.75rem", color: "#4A6072", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {result?.current || "Raíz"}
          </code>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray)", fontSize: "0.875rem" }}>Carregando...</div>
          ) : erro ? (
            <div style={{ padding: "1rem", color: "#C0392B", fontSize: "0.8125rem" }}>{erro}</div>
          ) : !result?.items.length ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--gray)", fontSize: "0.875rem" }}>Pasta vazia</div>
          ) : (
            result.items.map((item) => (
              <button
                key={item.fullPath}
                onClick={() => item.type === "fdb" ? onSelect(item.fullPath) : navigate(item.fullPath)}
                style={{
                  display: "flex", alignItems: "center", gap: "0.625rem",
                  width: "100%", padding: "0.625rem 1.125rem",
                  background: "transparent", border: "none", borderBottom: "1px solid #F0F4F7",
                  cursor: "pointer", textAlign: "left", transition: "background 0.1s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = item.type === "fdb" ? "rgba(27,122,140,0.06)" : "#F7FAFB")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {iconFor(item.type)}
                <span style={{ fontSize: "0.875rem", color: item.type === "fdb" ? "#1B7A8C" : "#0D2235", fontWeight: item.type === "fdb" ? 600 : 400 }}>
                  {item.name}
                </span>
                {item.type === "fdb" && (
                  <span style={{ marginLeft: "auto", fontSize: "0.6875rem", background: "#E8F4F8", color: "#1B7A8C", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>
                    Selecionar
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Modal de configuração ────────────────────────────────────────────────────

function ConfigModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (result: { database?: string; source?: FbConfigSource }) => void;
}) {
  const [cfg, setCfg]           = useState<Partial<FbConfig & { password: string }>>({});
  const [campos, setCampos]     = useState<string[]>([]);
  const [testing, setTesting]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [testMsg, setTestMsg]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading]   = useState(true);
  const [browsing, setBrowsing] = useState(false);
  const [clientesPreview, setClientesPreview] = useState<ClientesPreviewResponse | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [buscaClientes, setBuscaClientes]     = useState("");
  const [erroClientes, setErroClientes]       = useState("");
  const [saveMsg, setSaveMsg]                 = useState<{ ok: boolean; msg: string } | null>(null);
  const [sugestoes, setSugestoes]             = useState<FdbSugestao[]>([]);

  useEffect(() => {
    apiFetch<FbConfig>("/config/firebird")
      .then((c) => setCfg({ ...c, password: "" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const db = cfg.database?.trim();
    if (!db || db.toLowerCase().endsWith(".fdb")) {
      setSugestoes([]);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<{ suggestions: FdbSugestao[] }>(
        `/config/firebird/sugestoes?database=${encodeURIComponent(db)}`,
      )
        .then((r) => setSugestoes(r.suggestions))
        .catch(() => setSugestoes([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [cfg.database]);

  function aplicarSugestao(fullPath: string) {
    setCfg((c) => ({ ...c, database: fullPath }));
    setSugestoes([]);
    setTestMsg(null);
    setSaveMsg(null);
  }

  function capturarSugestoesDoErro(e: unknown) {
    if (isApiError(e) && e.suggestions?.length) {
      setSugestoes(e.suggestions);
    }
  }

  async function loadCampos() {
    if (!cfg.tabelaFinanceiro) return;
    try {
      const c = await apiFetch<string[]>("/config/firebird/campos", {
        method: "POST",
        body: JSON.stringify(cfg),
      });
      setCampos(c);
    } catch { setCampos([]); }
  }

  async function loadClientesPreview(search = buscaClientes) {
    setLoadingClientes(true);
    setErroClientes("");
    try {
      const r = await apiFetch<ClientesPreviewResponse>("/config/firebird/clientes/preview", {
        method: "POST",
        body: JSON.stringify({ ...cfg, search: search || undefined }),
      });
      setClientesPreview(r);
    } catch (e) {
      setClientesPreview(null);
      setErroClientes(e instanceof Error ? e.message : "Erro ao listar clientes.");
    } finally {
      setLoadingClientes(false);
    }
  }

  function buildSaveBody() {
    const body: Record<string, unknown> = {
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      tabelaFinanceiro: cfg.tabelaFinanceiro,
      campoCliente: cfg.campoCliente,
      campoVencimento: cfg.campoVencimento,
      campoDtLiquidacao: cfg.campoDtLiquidacao,
      campoVlLiquidado: cfg.campoVlLiquidado,
    };
    if (cfg.password) body.password = cfg.password;
    return body;
  }

  async function testConn() {
    setTesting(true); setTestMsg(null);
    setClientesPreview(null);
    setErroClientes("");
    try {
      const r = await apiFetch<{ ok: boolean; message: string; database?: string }>("/config/firebird/test", {
        method: "POST", body: JSON.stringify(cfg),
      });
      setTestMsg({ ok: r.ok, msg: r.message });
      if (r.ok) {
        if (r.database) setCfg((c) => ({ ...c, database: r.database }));
        loadCampos();
        loadClientesPreview("");
      }
    } catch (e) {
      capturarSugestoesDoErro(e);
      setTestMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro" });
    } finally { setTesting(false); }
  }

  async function testAndApply() {
    if (!cfg.database?.trim()) {
      setSaveMsg({ ok: false, msg: "Informe o caminho do banco (.fdb) antes de aplicar." });
      return;
    }

    setTesting(true);
    setSaveMsg(null);
    setTestMsg(null);
    setClientesPreview(null);
    setErroClientes("");

    try {
      const test = await apiFetch<{ ok: boolean; message: string; database?: string }>("/config/firebird/test", {
        method: "POST", body: JSON.stringify(cfg),
      });
      if (!test.ok) {
        setTestMsg({ ok: false, msg: test.message });
        return;
      }

      const cfgAtual = test.database ? { ...cfg, database: test.database } : cfg;
      if (test.database) setCfg((c) => ({ ...c, database: test.database }));

      setTestMsg({ ok: true, msg: test.message });
      loadCampos();
      await loadClientesPreview("");

      const res = await apiFetch<{ ok: boolean; message: string; database?: string; source?: FbConfigSource }>(
        "/config/firebird",
        { method: "PATCH", body: JSON.stringify({ ...buildSaveBody(), database: cfgAtual.database ?? cfg.database }) },
      );

      setSaveMsg({ ok: true, msg: res.message });
      onSaved({ database: res.database, source: res.source });
    } catch (e) {
      capturarSugestoesDoErro(e);
      const msg = e instanceof Error ? e.message : "Erro ao aplicar conexão.";
      setSaveMsg({ ok: false, msg });
      setTestMsg({ ok: false, msg });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!cfg.database?.trim()) {
      setSaveMsg({ ok: false, msg: "Informe o caminho do banco (.fdb) antes de salvar." });
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string; database?: string; source?: FbConfigSource }>(
        "/config/firebird",
        { method: "PATCH", body: JSON.stringify(buildSaveBody()) },
      );
      setSaveMsg({ ok: true, msg: res.message });
      onSaved({ database: res.database, source: res.source });
    } catch (e) {
      capturarSugestoesDoErro(e);
      setSaveMsg({ ok: false, msg: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally { setSaving(false); }
  }

  const set = (k: keyof typeof cfg, v: string | number) => setCfg((c) => ({ ...c, [k]: v }));
  const inputStyle: React.CSSProperties = { padding: "0.5rem 0.75rem", fontSize: "0.875rem", border: "1px solid #D8E3EA", borderRadius: 8, background: "#fff", outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 520 }}>
        {browsing && (
          <FileBrowser
            onClose={() => setBrowsing(false)}
            onSelect={(p) => { set("database", p); setBrowsing(false); }}
          />
        )}

        <div className="drawer-header">
          <div>
            <p className="drawer-title">Configuração do Banco Financeiro</p>
            <p className="drawer-subtitle">Firebird / Solutio — conexão e mapeamento de campos</p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="drawer-body">
          {loading ? <p style={{ color: "var(--gray)", fontSize: "0.875rem" }}>Carregando...</p> : (
            <>
              {/* Conexão */}
              <div className="form-section">
                <p className="form-section-title">Conexão Firebird</p>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Host / IP</label>
                    <input style={inputStyle} value={cfg.host ?? ""} onChange={(e) => set("host", e.target.value)} placeholder="localhost ou 192.168.x.x" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Porta</label>
                    <input style={inputStyle} type="number" value={cfg.port ?? 3050} onChange={(e) => set("port", parseInt(e.target.value) || 3050)} />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                  <label className="form-label">Caminho do banco (.fdb)</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input style={{ ...inputStyle, flex: 1 }} value={cfg.database ?? ""} onChange={(e) => set("database", e.target.value)} placeholder="D:\Seven\Solutio Server\Dados\AML_AUTO.FDB" />
                    <button type="button" className="btn-ghost" style={{ flexShrink: 0, padding: "0 0.875rem" }} onClick={() => setBrowsing(true)}>
                      <FolderOpen size={15} /> Procurar
                    </button>
                  </div>
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">Usuário</label>
                    <input style={inputStyle} value={cfg.user ?? "SYSDBA"} onChange={(e) => set("user", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Senha {cfg.passwordSet && <span className="form-label-optional">(já salva)</span>}</label>
                    <input style={inputStyle} type="password" value={cfg.password ?? ""} onChange={(e) => set("password", e.target.value)} placeholder={cfg.passwordSet ? "••••••• (não alterada)" : "Digite a senha"} />
                  </div>
                </div>

                <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: "0.5rem 0 0" }}>
                  A lista abaixo é só prévia do cadastro. A página Financeiro só muda depois de <strong>aplicar</strong> a conexão.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  <button className="btn-primary" onClick={testAndApply} disabled={testing || saving}>
                    {testing ? "Aplicando..." : "Testar e aplicar"}
                  </button>
                  <button className="btn-ghost" onClick={testConn} disabled={testing || saving}>
                    Só testar
                  </button>
                </div>
                {testMsg && (
                  <div style={{ marginTop: "0.625rem", padding: "0.625rem 0.875rem", borderRadius: 8, background: testMsg.ok ? "#E6F5F3" : "#FEE9E9", border: `1px solid ${testMsg.ok ? "#A3D9C9" : "#FDB9B9"}`, fontSize: "0.8125rem", color: testMsg.ok ? "#0F7A6B" : "#C0392B", whiteSpace: "pre-wrap" }}>
                    {testMsg.ok ? "✓ " : "✗ "}{testMsg.msg}
                  </div>
                )}

                {sugestoes.length > 0 && (
                  <div style={{ marginTop: "0.75rem", padding: "0.75rem", borderRadius: 8, border: "1px solid #D8E3EA", background: "#F7FAFB" }}>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)" }}>
                      Escolha o banco correto ({sugestoes.length} encontrados)
                    </p>
                    <p style={{ margin: "0 0 0.625rem", fontSize: "0.75rem", color: "var(--gray)" }}>
                      Não existe arquivo <strong>SOLUTIO_SEVEN.FDB</strong> — clique no que você usa no Solutio (o primeiro costuma ser o mais recente).
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", maxHeight: 160, overflowY: "auto" }}>
                      {sugestoes.map((s, i) => (
                        <button
                          key={s.path}
                          type="button"
                          onClick={() => aplicarSugestao(s.path)}
                          style={{
                            textAlign: "left", padding: "0.5rem 0.75rem", borderRadius: 6,
                            border: "1px solid #D8E3EA", background: "#fff", cursor: "pointer",
                            fontSize: "0.8125rem", color: "var(--navy)",
                          }}
                        >
                          {i === 0 && <span style={{ color: "#0F7A6B", fontWeight: 700, marginRight: "0.5rem" }}>Recomendado</span>}
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {testMsg?.ok && (
                  <div style={{ marginTop: "1rem", padding: "0.875rem", borderRadius: 8, border: "1px solid #D8E3EA", background: "#FAFCFD" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.625rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "var(--navy)" }}>
                        Clientes no banco
                        {clientesPreview && (
                          <span style={{ marginLeft: "0.5rem", fontWeight: 600, color: "var(--gray)" }}>
                            ({clientesPreview.total.toLocaleString("pt-BR")} total)
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                        onClick={() => loadClientesPreview()}
                        disabled={loadingClientes}
                      >
                        <RefreshCw size={12} /> Atualizar prévia
                      </button>
                    </div>

                    <div className="toolbar-search" style={{ marginBottom: "0.625rem" }}>
                      <Search size={14} />
                      <input
                        className="toolbar-input"
                        placeholder="Buscar razão social ou CNPJ..."
                        value={buscaClientes}
                        onChange={(e) => setBuscaClientes(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") loadClientesPreview(e.currentTarget.value); }}
                      />
                    </div>

                    {loadingClientes ? (
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--gray)" }}>Carregando clientes...</p>
                    ) : erroClientes ? (
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#C0392B" }}>{erroClientes}</p>
                    ) : !clientesPreview?.items.length ? (
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--gray)" }}>
                        {buscaClientes ? "Nenhum cliente encontrado para esta busca." : "Nenhum cliente encontrado na tabela CLIENTE."}
                      </p>
                    ) : (
                      <>
                        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E8EEF3", borderRadius: 8, background: "#fff" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                            <thead>
                              <tr style={{ background: "var(--navy)", position: "sticky", top: 0 }}>
                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>Código</th>
                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>Cliente</th>
                                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase" }}>CNPJ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clientesPreview.items.map((c) => (
                                <tr key={c.cdCliente} style={{ borderBottom: "1px solid #EEF2F5" }}>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray)", fontFamily: "monospace" }}>{c.cdCliente}</td>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--navy)" }}>{c.cliente}</td>
                                  <td style={{ padding: "0.5rem 0.75rem", color: "var(--gray)" }}>{c.cnpj || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {clientesPreview.total > clientesPreview.items.length && (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--gray)" }}>
                            Mostrando os primeiros {clientesPreview.items.length} de {clientesPreview.total.toLocaleString("pt-BR")} clientes. Use a busca para refinar.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mapeamento de campos */}
              <div className="form-section">
                <p className="form-section-title">Mapeamento — Tabela Financeira</p>
                <p style={{ fontSize: "0.75rem", color: "var(--gray)", marginBottom: "0.875rem" }}>
                  Defina o nome exato dos campos na sua tabela de parcelas. Após testar a conexão, os campos são carregados automaticamente.
                </p>
                <div className="form-group" style={{ marginBottom: "0.875rem" }}>
                  <label className="form-label">Tabela de parcelas</label>
                  <input style={inputStyle} value={cfg.tabelaFinanceiro ?? "CONTAS_PAGAR_RECEBER"} onChange={(e) => set("tabelaFinanceiro", e.target.value)} />
                </div>

                {[
                  { key: "campoCliente",      label: "Campo do cliente (ID/código)" },
                  { key: "campoVencimento",   label: "Campo de vencimento (DATE)" },
                  { key: "campoDtLiquidacao", label: "Campo data pagamento (liquidação)" },
                  { key: "campoVlLiquidado",  label: "Campo valor liquidado (NUMERIC)" },
                ].map(({ key, label }) => (
                  <div className="form-group" key={key} style={{ marginBottom: "0.75rem" }}>
                    <label className="form-label">{label}</label>
                    {campos.length > 0 ? (
                      <select
                        style={{ ...inputStyle, cursor: "pointer" }}
                        value={(cfg as Record<string, string>)[key] ?? ""}
                        onChange={(e) => set(key as keyof typeof cfg, e.target.value)}
                      >
                        <option value="">— Selecione o campo —</option>
                        {campos.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <input
                        style={inputStyle}
                        value={(cfg as Record<string, string>)[key] ?? ""}
                        onChange={(e) => set(key as keyof typeof cfg, e.target.value)}
                        placeholder="Ex: DT_VENCIMENTO_PAG_REC"
                      />
                    )}
                  </div>
                ))}

                {campos.length === 0 && (
                  <p style={{ fontSize: "0.75rem", color: "var(--gray)", fontStyle: "italic" }}>
                    Dica: teste a conexão primeiro para carregar os campos automaticamente nos selects acima.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="drawer-footer" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.5rem" }}>
          {saveMsg && (
            <div style={{
              padding: "0.625rem 0.875rem", borderRadius: 8, fontSize: "0.8125rem",
              background: saveMsg.ok ? "#E6F5F3" : "#FEE9E9",
              border: `1px solid ${saveMsg.ok ? "#A3D9C9" : "#FDB9B9"}`,
              color: saveMsg.ok ? "#0F7A6B" : "#C0392B",
            }}>
              {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn-primary" onClick={save} disabled={saving || loading || testing}>
              {saving ? "Aplicando..." : "Aplicar sem testar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

type ParcelaCliente = {
  cdCliente: number;
  cliente: string;
  cnpj: string;
  totalVencer: number;
  vencidas: number;
  parcelas: { vencimento: string; diasVencer: number }[];
};

type AlertasPeriodo = {
  tipo: "dias" | "intervalo" | "ate" | "desde";
  dias?: number;
  dataInicio?: string;
  dataFim?: string;
};

type AlertasResponse = {
  total: number;
  clientes: number;
  items: ParcelaCliente[];
  database?: string;
  source?: FbConfigSource;
  aviso?: string;
  periodo?: AlertasPeriodo;
};

type ParcelaDetalhe = {
  VENCIMENTO: string;
  DT_LIQUIDACAO: string | null;
  VL_LIQUIDADO: number;
  DIAS_VENCER: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: string) {
  if (!val) return "—";
  // Firebird retorna datas no formato "Mon DD YYYY" ou ISO
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("pt-BR");
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function currentYearStart() {
  return `${new Date().getFullYear()}-01-01`;
}

function currentYearEnd() {
  return `${new Date().getFullYear()}-12-31`;
}

function currentMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function currentMonthEnd() {
  const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

// ─── Persistência do filtro ───────────────────────────────────────────────────

const FILTRO_KEY = "financeiro-filtro-v1";

type FiltroSalvo =
  | { modo: "mes" }
  | { modo: "dias"; dias: number }
  | { modo: "custom"; di: string; df: string };

function carregarFiltro(): { di: string; df: string; preset: number | "mes" | null } {
  const fallback = { di: currentMonthStart(), df: currentMonthEnd(), preset: "mes" as const };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(FILTRO_KEY);
    if (!raw) return fallback;
    const f = JSON.parse(raw) as FiltroSalvo;
    if (f.modo === "mes")    return { di: currentMonthStart(), df: currentMonthEnd(), preset: "mes" };
    if (f.modo === "dias")   return { di: currentYearStart(),  df: addDaysISO(f.dias), preset: f.dias };
    if (f.modo === "custom") return { di: f.di, df: f.df, preset: null };
  } catch { /* ignore */ }
  return fallback;
}

function buildAlertasQuery(dias: number, dataInicio: string, dataFim: string) {
  const p = new URLSearchParams();
  if (dataInicio) p.set("dataInicio", dataInicio);
  if (dataFim) p.set("dataFim", dataFim);
  if (!dataInicio && !dataFim) p.set("dias", String(dias));
  return p.toString();
}

function labelPeriodo(periodo?: AlertasPeriodo, diasFiltro = 60) {
  if (!periodo) return `próximos ${diasFiltro} dias`;
  if (periodo.tipo === "intervalo" && periodo.dataInicio && periodo.dataFim) {
    return `${fmtDate(periodo.dataInicio)} a ${fmtDate(periodo.dataFim)}`;
  }
  if (periodo.tipo === "ate" && periodo.dataFim) {
    return `até ${fmtDate(periodo.dataFim)} (inclui atrasadas)`;
  }
  if (periodo.tipo === "desde" && periodo.dataInicio) {
    return `a partir de ${fmtDate(periodo.dataInicio)}`;
  }
  if (periodo.tipo === "dias" && periodo.dias) {
    return `próximos ${periodo.dias} dias (inclui atrasadas)`;
  }
  return `próximos ${diasFiltro} dias`;
}

function fmtCurrency(v: number) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function urgency(vencidas: number, total: number) {
  if (vencidas > 0) return { bg: "#FEE9E9", border: "#FDB9B9", badge: "#C0392B", label: `${vencidas} atrasada${vencidas !== 1 ? "s" : ""}` };
  if (total > 0)    return { bg: "#FFF8E6", border: "#F5C97A", badge: "#B07A00", label: `${total} vencendo` };
  return              { bg: "#EEF9F5",  border: "#A3D9C9", badge: "#0F7A6B", label: "Em dia" };
}

// ─── Card de cliente ──────────────────────────────────────────────────────────

type StatusFiltro = "todos" | "aberto" | "liquidado";

function ClienteCard({ item }: { item: ParcelaCliente }) {
  const [open, setOpen]             = useState(false);
  const [detalhes, setDetalhes]     = useState<ParcelaDetalhe[] | null>(null);
  const [loading, setLoading]       = useState(false);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("aberto");
  const urg = urgency(item.vencidas, item.totalVencer);

  async function loadDetalhes() {
    if (detalhes) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        dataInicio: currentYearStart(),
        dataFim:    currentYearEnd(),
      });
      const rows = await apiFetch<ParcelaDetalhe[]>(`/firebird/parcelas/cliente/${item.cdCliente}?${qs}`);
      setDetalhes(rows);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${urg.border}`, borderRadius: 10, background: "#fff", overflow: "hidden", transition: "box-shadow 0.15s" }}>
      {/* Header do card */}
      <button
        onClick={loadDetalhes}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: "1rem",
          padding: "0.875rem 1rem", background: open ? urg.bg : "#fff",
          border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s",
        }}
      >
        {open ? <ChevronDown size={16} style={{ color: "var(--gray)", flexShrink: 0 }} />
               : <ChevronRight size={16} style={{ color: "var(--gray)", flexShrink: 0 }} />}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--navy)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.cliente !== "—" ? item.cliente : `Cliente #${item.cdCliente || "?"}`}
          </p>
          {item.cnpj && (
            <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: "2px 0 0" }}>
              CNPJ: {item.cnpj}
            </p>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {item.vencidas > 0 && (
            <span style={{ background: "#FEE9E9", color: "#C0392B", fontSize: "0.6875rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "1px solid #FDB9B9" }}>
              {item.vencidas} atrasada{item.vencidas !== 1 ? "s" : ""}
            </span>
          )}
          {item.totalVencer > item.vencidas && (
            <span style={{ background: "#FFF4E0", color: "#B07A00", fontSize: "0.6875rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: "1px solid #F5C97A" }}>
              {item.totalVencer - item.vencidas} a vencer
            </span>
          )}
          <span style={{ background: urg.bg, color: urg.badge, fontSize: "0.6875rem", fontWeight: 700, padding: "3px 10px", borderRadius: 99, border: `1px solid ${urg.border}` }}>
            {item.totalVencer} parcela{item.totalVencer !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Detalhes — lista de parcelas */}
      {open && (
        <div style={{ borderTop: `1px solid ${urg.border}`, background: "#FAFCFD" }}>
          {loading ? (
            <p style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--gray)" }}>Carregando parcelas...</p>
          ) : !detalhes || detalhes.length === 0 ? (
            <p style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--gray)" }}>
              Nenhuma parcela em {new Date().getFullYear()}.
            </p>
          ) : (() => {
            const nAberto    = detalhes.filter(p => !p.DT_LIQUIDACAO).length;
            const nLiquidado = detalhes.filter(p =>  p.DT_LIQUIDACAO).length;
            const visiveis   = detalhes.filter(p =>
              statusFiltro === "todos"     ? true :
              statusFiltro === "aberto"    ? !p.DT_LIQUIDACAO :
                                             !!p.DT_LIQUIDACAO
            );

            const TAB_STYLE = (ativo: boolean): React.CSSProperties => ({
              padding: "0.3rem 0.875rem",
              borderRadius: 99,
              fontSize: "0.75rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: ativo ? "var(--navy)" : "transparent",
              color:      ativo ? "#fff"        : "var(--gray)",
              transition: "all 0.15s",
            });

            return (
              <>
                {/* Barra de filtro de status */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.625rem 1rem", borderBottom: "1px solid #E8EEF3" }}>
                  <span style={{ fontSize: "0.6875rem", color: "var(--gray)", marginRight: "0.25rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {new Date().getFullYear()}
                  </span>
                  <button style={TAB_STYLE(statusFiltro === "aberto")}    onClick={() => setStatusFiltro("aberto")}>
                    Em aberto ({nAberto})
                  </button>
                  <button style={TAB_STYLE(statusFiltro === "liquidado")} onClick={() => setStatusFiltro("liquidado")}>
                    Liquidados ({nLiquidado})
                  </button>
                  <button style={TAB_STYLE(statusFiltro === "todos")}     onClick={() => setStatusFiltro("todos")}>
                    Todos ({detalhes.length})
                  </button>
                </div>

                {visiveis.length === 0 ? (
                  <p style={{ padding: "1rem", fontSize: "0.8125rem", color: "var(--gray)" }}>
                    Nenhuma parcela nesta categoria.
                  </p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                    <thead>
                      <tr style={{ background: "var(--navy)" }}>
                        <th style={{ padding: "0.5rem 1rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vencimento</th>
                        <th style={{ padding: "0.5rem 1rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Situação</th>
                        <th style={{ padding: "0.5rem 1rem", textAlign: "right", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Vl. Pago</th>
                        <th style={{ padding: "0.5rem 1rem", textAlign: "left", color: "rgba(255,255,255,0.85)", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Dt. Liquidação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map((p, i) => {
                        const pago     = !!p.DT_LIQUIDACAO;
                        const diasVenc = Number(p.DIAS_VENCER ?? 0);
                        const atrasada = !pago && diasVenc < 0;
                        const urgente  = !pago && diasVenc >= 0 && diasVenc <= 30;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid #EEF2F5", background: i % 2 === 0 ? "#fff" : "#F9FBFC" }}>
                            <td style={{ padding: "0.625rem 1rem", fontWeight: atrasada ? 700 : 400, color: atrasada ? "#C0392B" : "var(--navy)" }}>
                              {fmtDate(p.VENCIMENTO)}
                            </td>
                            <td style={{ padding: "0.625rem 1rem" }}>
                              {pago ? (
                                <span style={{ background: "#E6F5F3", color: "#0F7A6B", fontSize: "0.6875rem", fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                                  ✓ Pago
                                </span>
                              ) : atrasada ? (
                                <span style={{ background: "#FEE9E9", color: "#C0392B", fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                                  ⚠ Atrasada {Math.abs(diasVenc)}d
                                </span>
                              ) : urgente ? (
                                <span style={{ background: "#FFF4E0", color: "#B07A00", fontSize: "0.6875rem", fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>
                                  Vence em {diasVenc}d
                                </span>
                              ) : (
                                <span style={{ background: "#EEF2F5", color: "#6B7E8C", fontSize: "0.6875rem", fontWeight: 600, padding: "2px 8px", borderRadius: 99 }}>
                                  Aberta — {diasVenc}d
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "0.625rem 1rem", textAlign: "right", color: "var(--gray)", fontFamily: "monospace" }}>
                              {p.VL_LIQUIDADO > 0 ? fmtCurrency(p.VL_LIQUIDADO) : "—"}
                            </td>
                            <td style={{ padding: "0.625rem 1rem", color: "var(--gray)" }}>
                              {p.DT_LIQUIDACAO ? fmtDate(p.DT_LIQUIDACAO) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [fbStatus,    setFbStatus]    = useState<FbStatus | null>(null);
  const [alertas,     setAlertas]     = useState<AlertasResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [busca,       setBusca]       = useState("");
  const [diasFiltro,  setDiasFiltro]  = useState(60);
  const [dataInicio,  setDataInicio]  = useState(() => carregarFiltro().di);
  const [dataFim,     setDataFim]     = useState(() => carregarFiltro().df);
  const [presetDias,  setPresetDias]  = useState<number | "mes" | null>(() => carregarFiltro().preset);
  const [erro,        setErro]        = useState("");
  const [showConfig,  setShowConfig]  = useState(false);
  const [saveOkMsg,   setSaveOkMsg]   = useState("");

  const load = useCallback(async (opts?: { dias?: number; dataInicio?: string; dataFim?: string }) => {
    const dias = opts?.dias ?? diasFiltro;
    const di   = opts?.dataInicio ?? dataInicio;
    const df   = opts?.dataFim ?? dataFim;
    setLoading(true);
    setErro("");
    try {
      const s = await apiFetch<FbStatus>("/firebird/status");
      setFbStatus(s);
      if (!s.connected) { setLoading(false); return; }

      const qs = buildAlertasQuery(dias, di, df);
      const a = await apiFetch<AlertasResponse>(`/firebird/parcelas/alertas?${qs}`);
      setAlertas(a);
    } catch (e) {
      setAlertas(null);
      setErro(e instanceof Error ? e.message : "Erro ao carregar dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, [diasFiltro, dataInicio, dataFim]);

  // Salva filtro sempre que muda
  useEffect(() => {
    if (typeof window === "undefined") return;
    let f: FiltroSalvo;
    if (presetDias === "mes")              f = { modo: "mes" };
    else if (typeof presetDias === "number") f = { modo: "dias", dias: presetDias };
    else                                     f = { modo: "custom", di: dataInicio, df: dataFim };
    localStorage.setItem(FILTRO_KEY, JSON.stringify(f));
  }, [dataInicio, dataFim, presetDias]);

  useEffect(() => {
    const f = carregarFiltro();
    load({ dataInicio: f.di, dataFim: f.df });
  }, []); // eslint-disable-line

  function handleMes() {
    const di = currentMonthStart();
    const df = currentMonthEnd();
    setPresetDias("mes");
    setDataInicio(di);
    setDataFim(df);
    load({ dataInicio: di, dataFim: df });
  }

  function handleFiltroDias(dias: number) {
    const di = currentYearStart();
    const df = addDaysISO(dias);
    setDiasFiltro(dias);
    setPresetDias(dias);
    setDataInicio(di);
    setDataFim(df);
    load({ dias, dataInicio: di, dataFim: df });
  }

  function handleFiltroPeriodo() {
    if (!dataInicio && !dataFim) {
      setErro("Informe ao menos uma data (De ou Até).");
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      setErro("A data inicial não pode ser posterior à data final.");
      return;
    }
    setPresetDias(null);
    setErro("");
    load({ dataInicio, dataFim });
  }

  const periodoLabel = labelPeriodo(alertas?.periodo, diasFiltro);

  const filtered = alertas?.items.filter(c =>
    !busca || c.cliente.toLowerCase().includes(busca.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(busca))
  ) ?? [];

  const totalAtrasadas = alertas?.items.reduce((s, c) => s + c.vencidas, 0) ?? 0;
  const totalVencendo  = alertas?.items.reduce((s, c) => s + (c.totalVencer - c.vencidas), 0) ?? 0;

  return (
    <div>
      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          onSaved={({ database, source }) => {
            setShowConfig(false);
            if (database) {
              setFbStatus({ connected: true, database, source });
              setSaveOkMsg(`Conexão aplicada: ${database}`);
            }
            load();
          }}
        />
      )}

      {saveOkMsg && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem",
          padding: "0.75rem 1rem", background: "#E6F5F3", border: "1px solid #A3D9C9",
          borderRadius: 8, marginBottom: "1rem",
        }}>
          <CheckCircle2 size={15} style={{ color: "#0F7A6B", flexShrink: 0 }} />
          <p style={{ fontSize: "0.8125rem", color: "#0F7A6B", margin: 0, flex: 1 }}>{saveOkMsg}</p>
          <button className="btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => setSaveOkMsg("")}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financeiro</h1>
          <p className="page-subtitle">Parcelas por cliente — Firebird / Solutio</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn-ghost" onClick={() => setShowConfig(true)}>
            <Settings size={14} /> Configurações
          </button>
          <button className="btn-ghost" onClick={() => load()}>
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </div>

      {/* Status Firebird */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        padding: "0.75rem 1rem", borderRadius: 10, marginBottom: "1.25rem",
        background: fbStatus?.connected ? "#E6F5F3" : "#FEE9E9",
        border: `1px solid ${fbStatus?.connected ? "#A3D9C9" : "#FDB9B9"}`,
      }}>
        {fbStatus?.connected
          ? <CheckCircle2 size={16} style={{ color: "#0F7A6B", flexShrink: 0 }} />
          : <XCircle size={16} style={{ color: "#C0392B", flexShrink: 0 }} />}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, margin: 0, color: fbStatus?.connected ? "#0F7A6B" : "#C0392B", whiteSpace: "pre-wrap" }}>
            {fbStatus?.connected
              ? `Conectado — ${fbStatus.database}`
              : `Sem conexão: ${fbStatus?.message ?? "verificando..."}`}
          </p>
          {fbStatus?.connected && fbStatus.source === "env" && (
            <p style={{ fontSize: "0.75rem", margin: "0.25rem 0 0", color: "#7A5100" }}>
              Origem: arquivo .env — salve em Configurações para trocar o banco de forma permanente.
            </p>
          )}
        </div>
      </div>

      {fbStatus?.connected && fbStatus.source === "env" && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 1rem", background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 8, marginBottom: "1rem" }}>
          <AlertTriangle size={15} style={{ color: "#B07A00", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: "0.8125rem", color: "#7A5100", margin: 0 }}>
            A conexão ativa ainda vem do <strong>.env</strong> ({fbStatus.database}). Abra <strong>Configurações</strong>, escolha o novo .fdb, teste e clique em <strong>Salvar configuração</strong> — só o teste não altera esta tela.
          </p>
        </div>
      )}

      {alertas?.aviso && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 1rem", background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 8, marginBottom: "1rem" }}>
          <AlertTriangle size={15} style={{ color: "#B07A00", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: "0.8125rem", color: "#7A5100", margin: 0 }}>{alertas.aviso}</p>
        </div>
      )}

      {erro && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.75rem 1rem", background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 8, marginBottom: "1rem" }}>
          <AlertTriangle size={15} style={{ color: "#B07A00", flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: "0.8125rem", color: "#7A5100", margin: 0, whiteSpace: "pre-wrap" }}>{erro}</p>
            {erro.includes("CD_CLIENTE") && (
              <button className="btn-ghost" style={{ marginTop: "0.5rem", fontSize: "0.8125rem" }} onClick={() => setShowConfig(true)}>
                Abrir Configurações e corrigir mapeamento
              </button>
            )}
          </div>
        </div>
      )}

      {fbStatus?.connected && (
        <>
          {/* Resumo */}
          {!loading && alertas && (
            <div className="stats-grid" style={{ marginBottom: "1.25rem" }}>
              <div className="card" style={{ padding: "1rem 1.25rem", borderTop: "3px solid #C0392B" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: "0 0 0.5rem" }}>Parcelas Atrasadas</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#C0392B", margin: 0 }}>{totalAtrasadas}</p>
              </div>
              <div className="card" style={{ padding: "1rem 1.25rem", borderTop: "3px solid #B07A00" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: "0 0 0.5rem" }}>A vencer no período</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "#B07A00", margin: 0 }}>{totalVencendo}</p>
              </div>
              <div className="card" style={{ padding: "1rem 1.25rem", borderTop: "3px solid var(--teal)" }}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: "0 0 0.5rem" }}>Clientes com Alerta</p>
                <p style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--navy)", margin: 0 }}>{alertas.clientes}</p>
              </div>
            </div>
          )}

          <p style={{ fontSize: "0.8125rem", color: "var(--gray)", margin: "0 0 1rem" }}>
            Esta lista mostra apenas clientes com <strong>parcelas em aberto</strong> (atrasadas ou a vencer no período).
            O teste em Configurações lista o cadastro completo do Solutio — por isso os totais podem ser bem diferentes.
          </p>

          {/* Toolbar */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
            <div className="toolbar">
              <div className="toolbar-search">
                <Search size={14} />
                <input
                  className="toolbar-input"
                  placeholder="Buscar cliente ou CNPJ..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div style={{
              display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "0.75rem",
              padding: "0.875rem 1rem", background: "#F9FBFC", border: "1px solid #E2E8F0", borderRadius: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "var(--gray)", marginRight: "0.25rem" }}>
                <Calendar size={15} />
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--navy)" }}>Vencimento</span>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#8B9EB0", textTransform: "uppercase", letterSpacing: "0.05em" }}>De</span>
                <input
                  type="date"
                  className="toolbar-input"
                  value={dataInicio}
                  onChange={(e) => { setDataInicio(e.target.value); setPresetDias(null); }}
                  style={{ width: 160, padding: "0.375rem 0.5rem" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "#8B9EB0", textTransform: "uppercase", letterSpacing: "0.05em" }}>Até</span>
                <input
                  type="date"
                  className="toolbar-input"
                  value={dataFim}
                  onChange={(e) => { setDataFim(e.target.value); setPresetDias(null); }}
                  style={{ width: 160, padding: "0.375rem 0.5rem" }}
                />
              </label>

              <button
                type="button"
                className="btn-primary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.8125rem" }}
                onClick={handleFiltroPeriodo}
              >
                Filtrar
              </button>

              <div style={{ width: 1, height: 32, background: "#E2E8F0", alignSelf: "center" }} />

              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--gray)", marginRight: "0.25rem" }}>Atalhos:</span>
                <button
                  type="button"
                  onClick={handleMes}
                  className={presetDias === "mes" ? "btn-primary" : "btn-ghost"}
                  style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
                >
                  Mês
                </button>
                {[30, 60, 90].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleFiltroDias(d)}
                    className={presetDias === d ? "btn-primary" : "btn-ghost"}
                    style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            <p style={{ fontSize: "0.75rem", color: "var(--gray)", margin: 0 }}>
              Período ativo: <strong style={{ color: "var(--navy)" }}>{periodoLabel}</strong>
              {!dataInicio && dataFim && (
                <span> — parcelas atrasadas também entram quando só o campo &quot;Até&quot; está preenchido.</span>
              )}
            </p>
          </div>

          {/* Lista de clientes */}
          {loading ? (
            <div className="empty-state"><p>Carregando dados financeiros...</p></div>
          ) : filtered.length === 0 && !erro ? (
            <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
              <CheckCircle2 size={40} style={{ color: "#0F7A6B", opacity: 0.4, margin: "0 auto 1rem" }} />
              <p style={{ fontWeight: 600, color: "var(--navy)", marginBottom: "0.25rem" }}>
                {busca ? "Nenhum cliente encontrado" : `Nenhuma parcela pendente — ${periodoLabel}`}
              </p>
              <p style={{ fontSize: "0.875rem", color: "var(--gray)" }}>
                {busca ? "Tente outro termo de busca" : "Ajuste as datas acima ou use os atalhos 30d / 60d / 90d."}
              </p>
            </div>
          ) : filtered.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              {filtered.map((item) => (
                <ClienteCard key={item.cdCliente} item={item} />
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
