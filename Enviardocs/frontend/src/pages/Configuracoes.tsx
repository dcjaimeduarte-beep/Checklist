import { useEffect, useState } from "react";
import { buscarTemplate, salvarTemplate, type Template } from "../services/api";

export function Configuracoes() {
  const [tpl, setTpl]         = useState<Template | null>(null);
  const [assunto, setAssunto] = useState("");
  const [corpo, setCorpo]     = useState("");
  const [salvando, setSalv]   = useState(false);
  const [msg, setMsg]         = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  useEffect(() => {
    buscarTemplate().then(t => {
      setTpl(t);
      setAssunto(t.assunto);
      setCorpo(t.corpo);
    });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalv(true);
    setMsg(null);
    try {
      await salvarTemplate(assunto, corpo);
      setMsg({ tipo: "ok", texto: "Configurações salvas com sucesso." });
    } catch {
      setMsg({ tipo: "erro", texto: "Erro ao salvar. Tente novamente." });
    } finally {
      setSalv(false);
    }
  }

  function restaurarPadrao() {
    if (!tpl) return;
    setAssunto(tpl.defaults.assunto);
    setCorpo(tpl.defaults.corpo);
    setMsg(null);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div>
        <h1 className="card__title">Configurações</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Personalize o texto do e-mail enviado aos clientes. Use <code>{"{{mes}}"}</code> para o mês de referência
          e <code>{"{{cliente}}"}</code> para o nome do cliente.
        </p>
      </div>

      <form className="card" onSubmit={salvar} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div className="form-group">
          <label className="form-label">Assunto do e-mail</label>
          <input
            className="form-input"
            value={assunto}
            onChange={e => setAssunto(e.target.value)}
            placeholder="Ex: Documentos {{mes}} — {{cliente}}"
            disabled={salvando}
          />
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
            Prévia: {assunto.replace("{{mes}}", "Maio/2026").replace("{{cliente}}", "EMPRESA EXEMPLO LTDA")}
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Corpo do e-mail</label>
          <textarea
            className="form-input"
            value={corpo}
            onChange={e => setCorpo(e.target.value)}
            rows={12}
            disabled={salvando}
            style={{ fontFamily: "monospace", fontSize: "var(--font-size-sm)", resize: "vertical" }}
          />
          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 4, display: "block" }}>
            Use <code>{"{{mes}}"}</code> e <code>{"{{cliente}}"}</code> onde quiser inserir o mês e o nome do cliente.
          </span>
        </div>

        {msg && (
          <div className={`alert alert--${msg.tipo === "ok" ? "success" : "error"}`}>
            {msg.texto}
          </div>
        )}

        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between" }}>
          <button type="button" className="btn btn--secondary" onClick={restaurarPadrao} disabled={salvando}>
            Restaurar padrão
          </button>
          <button type="submit" className="btn btn--primary" disabled={salvando || !assunto || !corpo}>
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>

      {/* Prévia do e-mail completo */}
      {corpo && (
        <div className="card">
          <div className="section-label">Prévia do e-mail</div>
          <div style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-4)",
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
          }}>
            {corpo.replace("{{mes}}", "Maio/2026").replace("{{cliente}}", "EMPRESA EXEMPLO LTDA")}
          </div>
        </div>
      )}
    </div>
  );
}
