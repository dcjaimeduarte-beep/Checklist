"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { Plus, FileText, Star, Pencil, X, Check, LayoutList } from "lucide-react";
import { useRouter } from "next/navigation";

type Template = {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// Variáveis disponíveis para o usuário consultar
const VARS = [
  { group: "Cliente (Contratante)", items: [
    { ph: "{{CONTRATANTE_RAZAO_SOCIAL}}", label: "Razão Social" },
    { ph: "{{CONTRATANTE_CNPJ}}", label: "CNPJ" },
    { ph: "{{CONTRATANTE_EMAIL}}", label: "E-mail" },
    { ph: "{{CONTRATANTE_TELEFONE}}", label: "Telefone" },
    { ph: "{{CONTRATANTE_CONTATO}}", label: "Nome do Contato" },
    { ph: "{{CONTRATANTE_ENDERECO}}", label: "Logradouro + Número" },
    { ph: "{{CONTRATANTE_BAIRRO}}", label: "Bairro" },
    { ph: "{{CONTRATANTE_CIDADE_UF}}", label: "Cidade/UF" },
    { ph: "{{CONTRATANTE_CEP}}", label: "CEP" },
  ]},
  { group: "Contrato", items: [
    { ph: "{{NUMERO_CONTRATO}}", label: "Número/Identificador" },
    { ph: "{{MODULOS}}", label: "Módulos contratados" },
    { ph: "{{VALOR_IMPLANTACAO}}", label: "Valor de Implantação (R$)" },
    { ph: "{{VALOR_IMPLANTACAO_EXTENSO}}", label: "Implantação por extenso" },
    { ph: "{{FORMA_PAGAMENTO_IMPLANTACAO}}", label: "Forma Pgto. Implantação" },
    { ph: "{{VALOR_MENSALIDADE}}", label: "Mensalidade (R$)" },
    { ph: "{{VALOR_MENSALIDADE_EXTENSO}}", label: "Mensalidade por extenso" },
    { ph: "{{MES_INICIO_PAGAMENTO}}", label: "Mês da 1ª Parcela" },
    { ph: "{{DIA_VENCIMENTO}}", label: "Dia de Vencimento" },
    { ph: "{{PRAZO}}", label: "Prazo do Contrato" },
    { ph: "{{MES_INICIO_CONTRATO}}", label: "Mês de Início" },
    { ph: "{{INDICE_REAJUSTE}}", label: "Índice de Reajuste" },
    { ph: "{{DATA_ASSINATURA}}", label: "Data de Assinatura" },
    { ph: "{{DISTANCIA_KM}}", label: "Distância (km)" },
  ]},
];

function EditorModal({ template, onClose, onSaved }: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = template === null;
  const [name, setName] = useState(template?.name ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function insertVar(ph: string) {
    setContent((c) => c + ph);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Nome é obrigatório."); return; }
    if (!content.trim()) { setError("Conteúdo é obrigatório."); return; }
    setError("");
    setSaving(true);
    try {
      if (isNew) {
        await apiFetch("/templates", { method: "POST", body: JSON.stringify({ name, content, isDefault }) });
      } else {
        await apiFetch(`/templates/${template!.id}`, { method: "PATCH", body: JSON.stringify({ name, content, isDefault }) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 780 }}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <p className="drawer-title">{isNew ? "Novo Template" : `Editar: ${template!.name}`}</p>
            <p className="drawer-subtitle">Use os campos abaixo para montar o texto do contrato com variáveis automáticas</p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body — 2 colunas */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

          {/* Coluna esquerda: editor */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "1.25rem", gap: "0.875rem", overflow: "auto" }}>
            <div className="form-group">
              <label className="form-label">Nome do template</label>
              <input
                className={`form-input${error && !name ? " error" : ""}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contrato Padrão Seven 2025"
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }} onClick={() => setIsDefault((v) => !v)}>
              <div style={{
                width: 18, height: 18, borderRadius: 4, border: `2px solid ${isDefault ? "var(--teal)" : "#D8E3EA"}`,
                background: isDefault ? "var(--teal)" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {isDefault && <Check size={11} color="#fff" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: "0.8125rem", color: "var(--navy)", fontWeight: 500 }}>Definir como template padrão</span>
              <Star size={13} style={{ color: isDefault ? "#f59e0b" : "var(--gray)" }} fill={isDefault ? "#f59e0b" : "none"} />
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Texto do contrato</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"Cole ou escreva aqui o texto do contrato.\nUse as variáveis do painel à direita para inserir dados automáticos.\n\nExemplo:\nContrato de Prestação de Serviços\n\nContratante: {{CONTRATANTE_RAZAO_SOCIAL}}\nCNPJ: {{CONTRATANTE_CNPJ}}\n..."}
                style={{
                  width: "100%", flex: 1, minHeight: 380, padding: "0.75rem",
                  fontSize: "0.8125rem", border: "1px solid #D8E3EA", borderRadius: 8,
                  background: "#FAFCFD", color: "var(--navy)", outline: "none",
                  resize: "vertical", fontFamily: "monospace", lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.625rem 0.875rem", fontSize: "0.8125rem", color: "#c53030" }}>
                {error}
              </div>
            )}
          </div>

          {/* Coluna direita: variáveis */}
          <div style={{ width: 240, borderLeft: "1px solid #E8EEF3", overflow: "auto", padding: "1.25rem 1rem", flexShrink: 0, background: "#FAFCFD" }}>
            <p style={{ fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--teal)", marginBottom: "1rem" }}>
              Variáveis disponíveis
            </p>
            <p style={{ fontSize: "0.6875rem", color: "var(--gray)", marginBottom: "1rem", lineHeight: 1.5 }}>
              Clique para inserir no texto. O sistema substituirá automaticamente pelo dado real.
            </p>
            {VARS.map((g) => (
              <div key={g.group} style={{ marginBottom: "1.25rem" }}>
                <p style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray)", marginBottom: "0.5rem" }}>
                  {g.group}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {g.items.map((v) => (
                    <button
                      key={v.ph}
                      type="button"
                      onClick={() => insertVar(v.ph)}
                      style={{
                        textAlign: "left", padding: "5px 8px", borderRadius: 6,
                        border: "1px solid #E0EAF0", background: "#fff", cursor: "pointer",
                        fontSize: "0.6875rem", color: "var(--navy)", transition: "all 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(27,122,140,0.06)";
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--teal)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "#fff";
                        (e.currentTarget as HTMLElement).style.borderColor = "#E0EAF0";
                      }}
                    >
                      <span style={{ display: "block", fontWeight: 600, color: "var(--teal)", fontSize: "0.625rem", fontFamily: "monospace" }}>{v.ph}</span>
                      <span style={{ color: "var(--gray)" }}>{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : isNew ? "Criar template" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<Template | null | "new">(undefined as unknown as null);
  const [showEditor, setShowEditor] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Template[]>("/templates");
      setTemplates(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openNew() { setEditing(null); setShowEditor(true); }
  function openEdit(t: Template) { setEditing(t); setShowEditor(true); }
  function closeEditor() { setShowEditor(false); }
  function handleSaved() { setShowEditor(false); void load(); }

  async function handleSetDefault(id: string) {
    await apiFetch(`/templates/${id}/set-default`, { method: "PATCH" });
    void load();
  }

  return (
    <div>
      {showEditor && (
        <EditorModal
          template={editing === "new" ? null : (editing as Template | null)}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Templates de Contrato</h1>
          <p className="page-subtitle">Gerencie os modelos de texto usados para gerar os contratos</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={15} />
          Novo template
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Carregando...</p></div>
      ) : templates.length === 0 ? (
        <div className="card" style={{ padding: "3rem 2rem", textAlign: "center" }}>
          <FileText size={40} style={{ color: "var(--gray)", opacity: 0.4, margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 600, color: "var(--navy)", marginBottom: "0.5rem" }}>Nenhum template cadastrado</p>
          <p style={{ fontSize: "0.875rem", color: "var(--gray)", marginBottom: "1.5rem" }}>
            Crie um template com o texto padrão do contrato e as variáveis que serão preenchidas automaticamente.
          </p>
          <button className="btn-primary" onClick={openNew}><Plus size={15} /> Criar primeiro template</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {templates.map((t) => (
            <div
              key={t.id}
              className="card"
              style={{ padding: "1.125rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem", borderLeft: t.isDefault ? "3px solid var(--teal)" : "3px solid transparent" }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.isDefault ? "rgba(27,122,140,0.1)" : "#F0F4F7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={16} style={{ color: t.isDefault ? "var(--teal)" : "var(--gray)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <p style={{ fontWeight: 600, color: "var(--navy)", fontSize: "0.9375rem" }}>{t.name}</p>
                  {t.isDefault && (
                    <span className="badge badge-active" style={{ fontSize: "0.625rem" }}>
                      <Star size={10} fill="currentColor" /> Padrão
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--gray)", marginTop: 2 }}>
                  {t.content.slice(0, 120).trim()}{t.content.length > 120 ? "..." : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                {!t.isDefault && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                    onClick={() => handleSetDefault(t.id)}
                  >
                    <Star size={13} /> Definir padrão
                  </button>
                )}
                <button
                  className="btn-ghost"
                  style={{ fontSize: "0.75rem", padding: "0.375rem 0.75rem" }}
                  onClick={() => router.push(`/dashboard/templates/${t.id}`)}
                  title="Editar cláusulas individualmente"
                >
                  <LayoutList size={14} /> Cláusulas
                </button>
                <button className="btn-ghost" style={{ padding: "0.375rem 0.75rem" }} onClick={() => openEdit(t)} title="Editar texto completo">
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
