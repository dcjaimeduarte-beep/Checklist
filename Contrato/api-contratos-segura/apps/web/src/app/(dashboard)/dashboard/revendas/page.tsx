"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Plus, Pencil, Trash2, X, Building2, Users, Save } from "lucide-react";

type Revenda = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  updatedAt: string;
  _count: { clients: number; users: number };
};

type RevendaForm = { name: string; contactName: string; email: string; phone: string };
const EMPTY_FORM: RevendaForm = { name: "", contactName: "", email: "", phone: "" };

export default function RevendasPage() {
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<Revenda | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Revenda | null>(null);

  async function load() {
    setLoading(true);
    try { setRevendas(await apiFetch<Revenda[]>("/revendas")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Revendas</h1>
          <p className="page-subtitle">{revendas.length} revenda{revendas.length !== 1 ? "s" : ""} cadastrada{revendas.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> Nova revenda
        </button>
      </div>

      {(creating || editing) && (
        <RevendaDrawer
          initial={editing ? { name: editing.name, contactName: editing.contactName ?? "", email: editing.email ?? "", phone: editing.phone ?? "" } : EMPTY_FORM}
          editId={editing?.id}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void load(); }}
        />
      )}

      {deleting && (
        <DeleteRevendaModal
          revenda={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => { setDeleting(null); void load(); }}
        />
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Responsável</th>
              <th>E-mail / Telefone</th>
              <th>Clientes</th>
              <th>Usuários</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="empty-state"><p>Carregando...</p></div></td></tr>
            ) : revendas.length === 0 ? (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <Building2 size={36} />
                  <p>Nenhuma revenda cadastrada</p>
                </div>
              </td></tr>
            ) : revendas.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td className="muted">{r.contactName ?? "—"}</td>
                <td>
                  {r.email && <span style={{ display: "block", fontSize: "0.875rem" }}>{r.email}</span>}
                  {r.phone && <span className="muted" style={{ fontSize: "0.75rem" }}>{r.phone}</span>}
                  {!r.email && !r.phone && <span className="muted">—</span>}
                </td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
                    <Building2 size={13} style={{ color: "#1B7A8C" }} /> {r._count.clients}
                  </span>
                </td>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.875rem" }}>
                    <Users size={13} style={{ color: "#0F7A6B" }} /> {r._count.users}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    <button className="btn-ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => setEditing(r)}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn-ghost" style={{ padding: "0.25rem 0.5rem", color: "#C0392B" }} onClick={() => setDeleting(r)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RevendaDrawer({ initial, editId, onClose, onSaved }: {
  initial: RevendaForm;
  editId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form,   setForm]   = useState<RevendaForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSave() {
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true); setError("");
    try {
      if (editId) {
        await apiFetch(`/revendas/${editId}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await apiFetch("/revendas", { method: "POST", body: JSON.stringify(form) });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 480 }}>
        <div className="drawer-header">
          <div>
            <p className="drawer-title">{editId ? "Editar Revenda" : "Nova Revenda"}</p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="form-group">
            <label className="form-label">Nome da Revenda *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Revenda Nordeste" />
          </div>
          <div className="form-group">
            <label className="form-label">Responsável <span className="form-label-optional">(opcional)</span></label>
            <input className="form-input" value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Nome do responsável" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">E-mail <span className="form-label-optional">(opcional)</span></label>
              <input className="form-input" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Telefone <span className="form-label-optional">(opcional)</span></label>
              <input className="form-input" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030" }}>{error}</p>}
        </div>
        <div className="drawer-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </>
  );
}

function DeleteRevendaModal({ revenda, onClose, onDeleted }: { revenda: Revenda; onClose: () => void; onDeleted: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleDelete() {
    setLoading(true);
    try {
      await apiFetch(`/revendas/${revenda.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(13,34,53,0.2)", zIndex: 51, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg,#7A1A1A,#A02020)", padding: "1.25rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: "1rem", margin: 0 }}>Excluir Revenda</p>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: "1.5rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--navy)", marginBottom: "0.5rem" }}>
            Tem certeza que deseja excluir <strong>{revenda.name}</strong>?
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--gray)", marginBottom: "1.25rem" }}>
            Os clientes e usuários vinculados ficarão sem revenda — os dados não serão apagados.
          </p>
          {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030", marginBottom: "1rem" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn-ghost" onClick={onClose} disabled={loading} style={{ flex: 1 }}>Cancelar</button>
            <button onClick={handleDelete} disabled={loading} style={{ flex: 1, padding: "0.625rem", borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Excluindo..." : "Excluir"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
