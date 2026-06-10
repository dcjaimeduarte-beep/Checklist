"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { Plus, Search, Building2, X, Download, CheckCircle2, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown, Pencil } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";

// ─── Types ───────────────────────────────────────────────────────────────────

type Client = {
  id: string;
  externalCode: number | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  revendaId: string | null;
  revenda: { id: string; name: string } | null;
  _count: { contracts: number };
};

type ApiResponse = {
  data: Client[];
  meta: { total: number; page: number; totalPages: number };
};

type FormData = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  contactName: string;
  email: string;
  phone: string;
  zipCode: string;
  street: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
  revendaId: string;
};

const EMPTY_FORM: FormData = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", inscricaoEstadual: "",
  contactName: "", email: "", phone: "", zipCode: "", street: "",
  addressNumber: "", addressComplement: "", neighborhood: "", city: "", state: "",
  revendaId: "",
};

// ─── Máscaras de formatação ───────────────────────────────────────────────────

function maskCnpjCpf(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    // Fixo: (00) 0000-0000
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  // Celular: (00) 00000-0000
  return digits
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

function maskZip(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

// ─── Drawer de cadastro ───────────────────────────────────────────────────────

function ClientDrawer({ onClose, onSaved, editId, initialData }: {
  onClose: () => void;
  onSaved: () => void;
  editId?: string;
  initialData?: Partial<FormData>;
}) {
  const isEdit    = !!editId;
  const authUser  = getCurrentUser();
  const isRevenda = authUser?.role === "revenda";

  // Se for usuário de revenda, preenche revendaId automaticamente
  const defaultRevendaId = isRevenda && authUser?.revendaId ? authUser.revendaId : "";
  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
    ...initialData,
    ...(isRevenda && !initialData?.revendaId ? { revendaId: defaultRevendaId } : {}),
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [revendas, setRevendas] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    // Só admin busca a lista de revendas — revenda usa o próprio ID automaticamente
    if (!isRevenda) {
      apiFetch<{ id: string; name: string }[]>("/revendas").then(setRevendas).catch(() => {});
    }
  }, [isRevenda]);
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  function set(field: keyof FormData, value: string) {
    let masked = value;
    if (field === "cnpj")    masked = maskCnpjCpf(value);
    if (field === "phone")   masked = maskPhone(value);
    if (field === "zipCode") masked = maskZip(value);
    setForm((f) => ({ ...f, [field]: masked }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));

    // Busca automática ao completar 9 chars (00000-000)
    if (field === "zipCode") {
      const digits = value.replace(/\D/g, "");
      if (digits.length === 8) fetchCep(digits);
      else setCepError("");
    }
  }

  async function fetchCep(digits: string) {
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setForm((f) => ({
        ...f,
        street:       data.logradouro ?? f.street,
        neighborhood: data.bairro     ?? f.neighborhood,
        city:         data.localidade ?? f.city,
        state:        data.uf         ?? f.state,
      }));
    } catch {
      setCepError("Erro ao consultar CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.razaoSocial.trim()) e.razaoSocial = "Razão Social é obrigatória";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setApiError("");
    setSaving(true);
    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v.trim() !== "")
      );
      if (isEdit) {
        await apiFetch(`/clients/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/clients", { method: "POST", body: JSON.stringify(body) });
      }
      onSaved();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <div>
            <p className="drawer-title">{isEdit ? "Editar Cliente" : "Novo Cliente"}</p>
            <p className="drawer-subtitle">{isEdit ? "Altere os dados do cliente" : "Preencha os dados do cliente para cadastrar"}</p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form id="client-form" onSubmit={handleSubmit} className="drawer-body">

          {/* Dados principais */}
          <div className="form-section">
            <p className="form-section-title">Dados Principais</p>

            {/* Vínculo com Revenda */}
            {isRevenda ? (
              <div className="form-group">
                <label className="form-label">Revenda</label>
                <div style={{ padding: "0.5rem 0.875rem", background: "#F0F9F7", border: "1px solid #1B7A8C30", borderRadius: 8, fontSize: "0.875rem", color: "#0F7A6B", fontWeight: 600 }}>
                  Vinculado automaticamente à sua revenda
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Revenda <span className="form-label-optional">(opcional)</span></label>
                <select className="form-input" value={form.revendaId} onChange={(e) => set("revendaId", e.target.value)}>
                  <option value="">Seven Sistemas — cliente direto</option>
                  {revendas.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Razão Social <span style={{ color: "#e53e3e" }}>*</span>
                </label>
                <input
                  className={`form-input${errors.razaoSocial ? " error" : ""}`}
                  value={form.razaoSocial}
                  onChange={(e) => set("razaoSocial", e.target.value)}
                  placeholder="Nome completo da empresa"
                />
                {errors.razaoSocial && <span className="form-error">{errors.razaoSocial}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Nome Fantasia <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  className="form-input"
                  value={form.nomeFantasia}
                  onChange={(e) => set("nomeFantasia", e.target.value)}
                  placeholder="Nome comercial"
                />
              </div>
            </div>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">
                  CNPJ / CPF <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  className="form-input"
                  value={form.cnpj}
                  onChange={(e) => set("cnpj", e.target.value)}
                  placeholder="00.000.000/0001-00"
                  inputMode="numeric"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Inscrição Estadual <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  className="form-input"
                  value={form.inscricaoEstadual}
                  onChange={(e) => set("inscricaoEstadual", e.target.value)}
                  placeholder="000.000.000.000"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Nome do Contato / Responsável <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  className="form-input"
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                  placeholder="Nome da pessoa de contato na empresa"
                />
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="form-section">
            <p className="form-section-title">Contato</p>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">
                  E-mail <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  type="email"
                  className={`form-input${errors.email ? " error" : ""}`}
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contato@empresa.com"
                />
                {errors.email && <span className="form-error">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">
                  Celular / Telefone <span className="form-label-optional">(opcional)</span>
                </label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                />
                <span style={{ fontSize: "0.65rem", color: "var(--gray)", marginTop: 2 }}>
                  Formatado automaticamente — fixo ou celular
                </span>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div className="form-section">
            <p className="form-section-title">Endereço <span className="form-label-optional" style={{ textTransform: "none", letterSpacing: 0 }}>(opcional)</span></p>

            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">CEP</label>
                <div style={{ position: "relative" }}>
                  <input
                    className={`form-input${cepError ? " error" : ""}`}
                    value={form.zipCode}
                    onChange={(e) => set("zipCode", e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                    style={{ paddingRight: cepLoading ? "2.25rem" : undefined }}
                  />
                  {cepLoading && (
                    <div style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)" }}>
                      <div style={{ width: 14, height: 14, border: "2px solid #D8E3EA", borderTopColor: "var(--teal)", borderRadius: "50%", animation: "spinner 0.65s linear infinite" }} />
                    </div>
                  )}
                </div>
                {cepError && <span className="form-error">{cepError}</span>}
                {!cepError && !cepLoading && form.zipCode.replace(/\D/g, "").length === 8 && (
                  <span style={{ fontSize: "0.65rem", color: "#0F7A6B", marginTop: 2, display: "block" }}>
                    ✓ Endereço preenchido automaticamente
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: "0.1rem" }}>
                <p style={{ fontSize: "0.6875rem", color: "var(--gray)", lineHeight: 1.4 }}>
                  Digite o CEP e o endereço será preenchido automaticamente via ViaCEP.
                </p>
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Logradouro</label>
                <input
                  className="form-input"
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                  placeholder="Rua, Av, etc."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Número</label>
                <input
                  className="form-input"
                  value={form.addressNumber}
                  onChange={(e) => set("addressNumber", e.target.value)}
                  placeholder="123"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Complemento</label>
                <input
                  className="form-input"
                  value={form.addressComplement}
                  onChange={(e) => set("addressComplement", e.target.value)}
                  placeholder="Sala, Andar..."
                />
              </div>
            </div>

            <div className="form-row form-row-3">
              <div className="form-group">
                <label className="form-label">Bairro</label>
                <input
                  className="form-input"
                  value={form.neighborhood}
                  onChange={(e) => set("neighborhood", e.target.value)}
                  placeholder="Bairro"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Cidade</label>
                <input
                  className="form-input"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  placeholder="Cidade"
                />
              </div>
              <div className="form-group">
                <label className="form-label">UF</label>
                <select
                  className="form-input"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                >
                  <option value="">UF</option>
                  {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {apiError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#c53030", marginTop: "0.5rem" }}>
              {apiError}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="drawer-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="client-form" className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar cliente"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function ClientsPage() {
  type SortField = "externalCode" | "razaoSocial" | "cnpj";
  type SortDir   = "asc" | "desc";

  const [data,    setData]    = useState<Client[]>([]);
  const [meta,    setMeta]    = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState("");
  const [perPage, setPerPage] = useState(20);
  const [sortBy,  setSortBy]  = useState<SortField>("razaoSocial");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  type SyncStatus = { ranAt: string | null; total?: number; created?: number; updated?: number; error?: string; durationMs?: number };

  const [showDrawer,    setShowDrawer]    = useState(false);
  const [editClient,    setEditClient]    = useState<{ id: string; data: Partial<FormData> } | null>(null);
  const [importing,     setImporting]     = useState<"new" | "update" | false>(false);
  const [importResult,  setImportResult]  = useState<{ total: number; created: number; updated: number; skipped: number; mode: "new" | "update" } | null>(null);
  const [importError,   setImportError]   = useState("");
  const [syncStatus,   setSyncStatus]   = useState<SyncStatus | null>(null);

  useEffect(() => {
    apiFetch<SyncStatus>("/clients/sync-status").then(setSyncStatus).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(perPage), sortBy, sortDir });
      if (search) p.set("search", search);
      const res = await apiFetch<ApiResponse>(`/clients?${p}`);
      setData(res.data);
      setMeta(res.meta);
    } finally {
      setLoading(false);
    }
  }, [page, search, perPage, sortBy, sortDir]);

  useEffect(() => { void load(); }, [load]);

  function handleSearch(v: string) { setSearch(v); setPage(1); }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
    setPage(1);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ChevronsUpDown size={13} style={{ opacity: 0.35, marginLeft: 4 }} />;
    return sortDir === "asc"
      ? <ChevronUp   size={13} style={{ color: "#1B7A8C", marginLeft: 4 }} />
      : <ChevronDown size={13} style={{ color: "#1B7A8C", marginLeft: 4 }} />;
  }

  function handleSaved() {
    setShowDrawer(false);
    setEditClient(null);
    void load();
  }

  async function openEdit(c: Client) {
    const full = await apiFetch<{
      razaoSocial: string; nomeFantasia?: string | null; cnpj?: string | null;
      inscricaoEstadual?: string | null; email?: string | null; phone?: string | null;
      contactName?: string | null; street?: string | null; addressNumber?: string | null;
      addressComplement?: string | null; neighborhood?: string | null; city?: string | null;
      state?: string | null; zipCode?: string | null; revendaId?: string | null;
    }>(`/clients/${c.id}`);
    setEditClient({
      id: c.id,
      data: {
        razaoSocial:       full.razaoSocial         ?? "",
        nomeFantasia:      full.nomeFantasia         ?? "",
        cnpj:              full.cnpj                ?? "",
        inscricaoEstadual: full.inscricaoEstadual    ?? "",
        email:             full.email               ?? "",
        phone:             full.phone               ?? "",
        contactName:       full.contactName         ?? "",
        street:            full.street              ?? "",
        addressNumber:     full.addressNumber        ?? "",
        addressComplement: full.addressComplement    ?? "",
        neighborhood:      full.neighborhood         ?? "",
        city:              full.city                ?? "",
        state:             full.state               ?? "",
        zipCode:           full.zipCode             ?? "",
        revendaId:         full.revendaId           ?? "",
      },
    });
  }

  return (
    <div>
      {showDrawer && (
        <ClientDrawer onClose={() => setShowDrawer(false)} onSaved={handleSaved} />
      )}
      {editClient && (
        <ClientDrawer
          onClose={() => setEditClient(null)}
          onSaved={handleSaved}
          editId={editClient.id}
          initialData={editClient.data}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {meta.total} cliente{meta.total !== 1 ? "s" : ""} cadastrado{meta.total !== 1 ? "s" : ""}
            </p>
            {syncStatus && (
              <span style={{
                fontSize: "0.6875rem", fontWeight: 600, padding: "2px 8px", borderRadius: 99,
                background: syncStatus.error ? "#FEE9E9" : "#E6F5F3",
                color:      syncStatus.error ? "#C0392B"  : "#0F7A6B",
                border:     `1px solid ${syncStatus.error ? "#FDB9B9" : "#A3D9C9"}`,
                whiteSpace: "nowrap",
              }}>
                {syncStatus.ranAt
                  ? `Sync: ${new Date(syncStatus.ranAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${syncStatus.error ? " ✗" : " ✓"}`
                  : "Nunca sincronizado"}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            disabled={!!importing}
            onClick={async () => {
              setImporting("new");
              setImportResult(null);
              setImportError("");
              try {
                const r = await apiFetch<{ total: number; created: number; updated: number; skipped: number; ranAt?: string }>(
                  "/clients/import-from-firebird",
                  { method: "POST" }
                );
                setImportResult({ ...r, mode: "new" });
                if (r.ranAt) setSyncStatus({ ranAt: r.ranAt, total: r.total, created: r.created, updated: r.updated });
                void load();
              } catch (e) {
                setImportError(e instanceof Error ? e.message : "Erro na importação.");
              } finally {
                setImporting(false);
              }
            }}
          >
            <Download size={14} />
            {importing === "new" ? "Importando..." : "Importar novos"}
          </button>
          <button
            className="btn-ghost"
            disabled={!!importing}
            onClick={async () => {
              setImporting("update");
              setImportResult(null);
              setImportError("");
              try {
                const r = await apiFetch<{ total: number; created: number; updated: number; skipped: number; ranAt?: string }>(
                  "/clients/import-from-firebird?updateExisting=true",
                  { method: "POST" }
                );
                setImportResult({ ...r, mode: "update" });
                if (r.ranAt) setSyncStatus({ ranAt: r.ranAt, total: r.total, created: r.created, updated: r.updated });
                void load();
              } catch (e) {
                setImportError(e instanceof Error ? e.message : "Erro na importação.");
              } finally {
                setImporting(false);
              }
            }}
          >
            <Download size={14} />
            {importing === "update" ? "Atualizando..." : "Atualizar existentes"}
          </button>
          <button className="btn-primary" onClick={() => setShowDrawer(true)}>
            <Plus size={15} />
            Novo cliente
          </button>
        </div>
      </div>

      {/* Resultado da importação */}
      {importResult && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "#E6F5F3", border: "1px solid #A3D9C9", borderRadius: 8, marginBottom: "1rem" }}>
          <CheckCircle2 size={16} style={{ color: "#0F7A6B", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#0F7A6B", flex: 1 }}>
            {importResult.mode === "update"
              ? <>Atualização concluída — {importResult.total} lidos: <strong>{importResult.updated} atualizados</strong>, {importResult.created} criados, {importResult.skipped} ignorados.</>
              : <>Importação concluída — {importResult.total} lidos: <strong>{importResult.created} novos cadastrados</strong>, {importResult.skipped} já existentes (ignorados).</>
            }
          </p>
          <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem" }} onClick={() => setImportResult(null)}>×</button>
        </div>
      )}
      {importError && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", background: "#FEE9E9", border: "1px solid #FDB9B9", borderRadius: 8, marginBottom: "1rem" }}>
          <AlertTriangle size={16} style={{ color: "#C0392B", flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#C0392B", flex: 1 }}>{importError}</p>
          <button className="btn-ghost" style={{ padding: "0.2rem 0.5rem" }} onClick={() => setImportError("")}>×</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-search">
          <Search size={14} />
          <input
            className="toolbar-input"
            placeholder="Buscar por nome, CNPJ ou e-mail..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          <span style={{ fontSize: "0.8125rem", color: "var(--gray)", whiteSpace: "nowrap" }}>Exibir:</span>
          <select
            className="toolbar-select"
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            style={{ width: "auto", minWidth: 80 }}
          >
            {[20, 50, 100, 200, 500].map(n => (
              <option key={n} value={n}>{n} por pág.</option>
            ))}
            <option value={5000}>Todos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th
                style={{ width: 72, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                onClick={() => handleSort("externalCode")}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  Cód. <SortIcon field="externalCode" />
                </span>
              </th>
              <th
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => handleSort("razaoSocial")}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  Razão Social <SortIcon field="razaoSocial" />
                </span>
              </th>
              <th
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => handleSort("cnpj")}
              >
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  CNPJ <SortIcon field="cnpj" />
                </span>
              </th>
              <th>Cidade / UF</th>
              <th>Contato</th>
              <th className="right">Contratos</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state"><p>Carregando...</p></div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Building2 size={36} />
                    <p>Nenhum cliente encontrado</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((c) => (
                <tr key={c.id}>
                  <td className="muted" style={{ textAlign: "center" }}>{c.externalCode ?? "—"}</td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{c.razaoSocial}</span>
                    {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                      <span className="muted" style={{ display: "block", fontSize: "0.75rem" }}>{c.nomeFantasia}</span>
                    )}
                    {c.revenda && (
                      <span style={{ display: "inline-block", marginTop: 3, fontSize: "0.625rem", fontWeight: 700, color: "#0F7A6B", background: "#0F7A6B15", borderRadius: 99, padding: "1px 6px" }}>
                        {c.revenda.name}
                      </span>
                    )}
                  </td>
                  <td className="muted mono">{c.cnpj ?? "—"}</td>
                  <td className="muted">
                    {c.city && c.state ? `${c.city} / ${c.state}` : "—"}
                  </td>
                  <td className="muted">
                    {c.email && <span style={{ display: "block", fontSize: "0.75rem" }}>{c.email}</span>}
                    {c.phone && <span style={{ display: "block", fontSize: "0.75rem" }}>{c.phone}</span>}
                    {!c.email && !c.phone ? "—" : null}
                  </td>
                  <td className="right" style={{ fontWeight: 500 }}>
                    {c._count.contracts}
                  </td>
                  <td>
                    <span className={`badge ${c.status === "active" ? "badge-active" : "badge-inactive"}`}>
                      {c.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-ghost"
                      style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                      onClick={() => openEdit(c)}
                      title="Editar cliente"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {meta.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            label="clientes"
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
