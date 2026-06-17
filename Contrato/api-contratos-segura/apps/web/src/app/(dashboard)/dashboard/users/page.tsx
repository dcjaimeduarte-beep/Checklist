"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Plus, Users, X, Save, CheckCircle2, XCircle, Pencil } from "lucide-react";

type Revenda = { id: string; name: string };

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  revendaId: string | null;
  revenda: { id: string; name: string } | null;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin:     "Admin",
  juridico:  "Jurídico",
  comercial: "Comercial",
  operador:  "Operador",
  revenda:   "Revenda",
};
const ROLE_COLORS: Record<string, string> = {
  admin:     "#0D2235",
  juridico:  "#1B7A8C",
  comercial: "#7A5100",
  operador:  "#4A6072",
  revenda:   "#0F7A6B",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function UsersPage() {
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing,  setEditing]  = useState<User | null>(null);

  async function load() {
    setLoading(true);
    try { setUsers(await apiFetch<User[]>("/users")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function toggleStatus(u: User) {
    const newStatus = u.status === "active" ? "inactive" : "active";
    await apiFetch(`/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    void load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="page-subtitle">{users.length} usuário{users.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> Novo usuário
        </button>
      </div>

      {creating && (
        <UserDrawer onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void load(); }} />
      )}
      {editing && (
        <UserDrawer user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />
      )}

      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Perfil</th>
              <th>Revenda</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6}><div className="empty-state"><p>Carregando...</p></div></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7}>
                <div className="empty-state"><Users size={36} /><p>Nenhum usuário cadastrado</p></div>
              </td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="muted" style={{ fontSize: "0.875rem" }}>{u.email}</td>
                <td>
                  <span style={{
                    fontSize: "0.6875rem", fontWeight: 700,
                    color: ROLE_COLORS[u.role] ?? "#4A6072",
                    background: `${ROLE_COLORS[u.role] ?? "#4A6072"}15`,
                    borderRadius: 99, padding: "2px 8px",
                  }}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td>
                  {u.revenda ? (
                    <span style={{ fontSize: "0.8125rem", color: "#0F7A6B", fontWeight: 500 }}>{u.revenda.name}</span>
                  ) : (
                    <span className="muted">Seven (Matriz)</span>
                  )}
                </td>
                <td className="muted" style={{ fontSize: "0.8125rem" }}>
                  {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Nunca"}
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus(u)}
                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: u.status === "active" ? "#0F7A6B" : "#C0392B" }}
                    title={u.status === "active" ? "Clique para inativar" : "Clique para ativar"}
                  >
                    {u.status === "active"
                      ? <><CheckCircle2 size={14} /> Ativo</>
                      : <><XCircle size={14} /> Inativo</>}
                  </button>
                </td>
                <td>
                  <button
                    onClick={() => setEditing(u)}
                    title="Editar usuário"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#4A6072", padding: "4px" }}
                  >
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserDrawer({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:      user?.name      ?? "",
    email:     user?.email     ?? "",
    password:  "",
    role:      user?.role      ?? "operador",
    revendaId: user?.revendaId ?? "",
  });
  const [revendas, setRevendas] = useState<Revenda[]>([]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    apiFetch<Revenda[]>("/revendas").then(setRevendas).catch(() => {});
  }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) { setError("Nome e e-mail são obrigatórios."); return; }
    if (!isEdit && !form.password) { setError("Informe uma senha."); return; }
    if (form.password && form.password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); return; }
    if (form.role === "revenda" && !form.revendaId) { setError("Selecione a revenda para este usuário."); return; }
    setSaving(true); setError("");
    try {
      if (isEdit) {
        const body: Record<string, unknown> = {
          name:      form.name.trim(),
          email:     form.email.trim(),
          role:      form.role,
          revendaId: form.revendaId || null,
        };
        if (form.password) body.password = form.password;
        await apiFetch(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({
            name:      form.name.trim(),
            email:     form.email.trim(),
            password:  form.password,
            role:      form.role,
            revendaId: form.revendaId || undefined,
          }),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar usuário.");
    } finally { setSaving(false); }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width: 480 }}>
        <div className="drawer-header">
          <div>
            <p className="drawer-title">{isEdit ? "Editar Usuário" : "Novo Usuário"}</p>
            <p className="drawer-subtitle">{isEdit ? `Editando ${user.name}` : "Preencha os dados de acesso"}</p>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="drawer-body">
          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do usuário" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail *</label>
            <input className="form-input" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{isEdit ? "Nova senha (deixe em branco para não alterar)" : "Senha *"}</label>
            <input className="form-input" type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
          </div>
          <div className="form-group">
            <label className="form-label">Perfil de acesso *</label>
            <select className="form-input" value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value, revendaId: "" }))}>
              <option value="admin">Admin — acesso total</option>
              <option value="juridico">Jurídico — contratos e templates</option>
              <option value="comercial">Comercial — clientes e contratos</option>
              <option value="operador">Operador — somente leitura</option>
              <option value="revenda">Revenda — vê apenas seus clientes</option>
            </select>
          </div>
          {form.role === "revenda" && (
            <div className="form-group">
              <label className="form-label">Revenda *</label>
              <select className="form-input" value={form.revendaId} onChange={(e) => setForm(f => ({ ...f, revendaId: e.target.value }))}>
                <option value="">Selecione a revenda...</option>
                {revendas.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {revendas.length === 0 && (
                <p style={{ fontSize: "0.75rem", color: "#B07A00", marginTop: "0.375rem" }}>
                  Nenhuma revenda cadastrada ainda. Crie uma em Revendas primeiro.
                </p>
              )}
            </div>
          )}
          {error && <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030" }}>{error}</p>}
        </div>
        <div className="drawer-footer">
          <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
          </button>
        </div>
      </div>
    </>
  );
}
