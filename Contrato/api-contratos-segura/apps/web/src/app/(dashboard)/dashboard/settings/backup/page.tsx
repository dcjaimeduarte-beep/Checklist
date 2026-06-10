"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Download, Mail, Play, Save, Clock, CheckCircle2, AlertTriangle, RefreshCw, Upload } from "lucide-react";

interface BackupConfig {
  ativo: boolean;
  hora: string;
  enviar_email: boolean;
  email_destino: string;
  manter_dias: number;
  ultimo_backup: string | null;
  ultimo_status: string | null;
}

export default function BackupPage() {
  const [config, setConfig]       = useState<BackupConfig | null>(null);
  const [form, setForm]           = useState<BackupConfig | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [running, setRunning]     = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [message, setMessage]     = useState<{ type: "ok" | "error"; text: string } | null>(null);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<BackupConfig>("/backup/config");
      setConfig(data);
      setForm(data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiFetch("/backup/config", { method: "PUT", body: JSON.stringify(form) });
      setConfig(form);
      setMessage({ type: "ok", text: "Configuração salva com sucesso." });
    } catch {
      setMessage({ type: "error", text: "Erro ao salvar configuração." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>("/backup/agora", { method: "POST" });
      setMessage({ type: res.ok ? "ok" : "error", text: res.message });
      void load();
    } catch {
      setMessage({ type: "error", text: "Erro ao executar backup." });
    } finally {
      setRunning(false);
    }
  }

  async function handleRestore() {
    if (!restoreFile) return;
    if (!confirm("Tem certeza? Os dados existentes serão sobrescritos pelos dados do backup.")) return;
    setRestoring(true);
    setMessage(null);
    try {
      const text = await restoreFile.text();
      const res = await apiFetch<{ ok: boolean; message: string }>("/backup/restaurar", {
        method: "POST",
        body: JSON.stringify({ jsonData: text }),
      });
      setMessage({ type: res.ok ? "ok" : "error", text: res.message });
      setRestoreFile(null);
    } catch {
      setMessage({ type: "error", text: "Erro ao restaurar backup." });
    } finally {
      setRestoring(false);
    }
  }

  async function handleExport() {
    const token = localStorage.getItem("token");
    const url   = `${process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3333"}/backup/exportar`;
    const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setMessage({ type: "error", text: "Erro ao exportar backup." }); return; }
    const blob = await res.blob();
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `backup-contratos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function setField<K extends keyof BackupConfig>(key: K, value: BackupConfig[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  const ultimoOk = config?.ultimo_status === "ok";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>Backup do Sistema</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
          Configure backups automáticos e envio por e-mail.
        </p>
      </div>

      {/* Status do último backup */}
      {config?.ultimo_backup && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.75rem",
          padding: "0.875rem 1rem", borderRadius: 10, marginBottom: "1.5rem",
          background: ultimoOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${ultimoOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
        }}>
          {ultimoOk
            ? <CheckCircle2 size={16} color="#10b981" />
            : <AlertTriangle size={16} color="#ef4444" />}
          <div>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: ultimoOk ? "#10b981" : "#ef4444", margin: 0 }}>
              {ultimoOk ? "Último backup realizado com sucesso" : "Último backup com erro"}
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0 }}>
              {new Date(config.ultimo_backup).toLocaleString("pt-BR")}
              {!ultimoOk && config.ultimo_status && ` — ${config.ultimo_status}`}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: "var(--muted)", textAlign: "center" }}>Carregando...</p>
      ) : form && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Agendamento automático */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Clock size={15} /> Agendamento automático
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setField("ativo", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>Ativar backup diário automático</span>
              </label>
              <div>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Horário do backup
                </label>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setField("hora", e.target.value)}
                  disabled={!form.ativo}
                  className="input"
                  style={{ width: 130, opacity: form.ativo ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* Envio por e-mail */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Mail size={15} /> Envio por e-mail
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.enviar_email}
                  onChange={(e) => setField("enviar_email", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span style={{ fontSize: "0.875rem", color: "var(--text)" }}>Enviar backup por e-mail</span>
              </label>
              {form.enviar_email && (
                <div>
                  <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                    E-mail de destino
                  </label>
                  <input
                    type="email"
                    value={form.email_destino}
                    onChange={(e) => setField("email_destino", e.target.value)}
                    placeholder="exemplo@email.com"
                    className="input"
                    style={{ width: "100%" }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Restaurar backup */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Upload size={15} /> Restaurar backup
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "1rem" }}>
              Selecione um arquivo JSON gerado por este sistema. Clientes, contratos e templates serão restaurados. Usuários não são alterados.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: "0.5rem",
                padding: "0.45rem 1rem", borderRadius: 8, cursor: "pointer",
                border: "1px dashed rgba(139,158,176,0.35)", fontSize: "0.8rem",
                color: restoreFile ? "var(--primary)" : "var(--muted)",
                background: restoreFile ? "rgba(27,122,140,0.08)" : "transparent",
              }}>
                <Upload size={13} />
                {restoreFile ? restoreFile.name : "Escolher arquivo .json"}
                <input type="file" accept=".json" style={{ display: "none" }}
                  onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} />
              </label>
              {restoreFile && (
                <button
                  onClick={handleRestore}
                  disabled={restoring}
                  className="btn"
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#dc2626", color: "#fff", border: "none" }}
                >
                  {restoring ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Upload size={13} />}
                  {restoring ? "Restaurando..." : "Restaurar agora"}
                </button>
              )}
            </div>
          </div>

          {/* Mensagem de feedback */}
          {message && (
            <div style={{
              padding: "0.75rem 1rem", borderRadius: 8,
              background: message.type === "ok" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
              border: `1px solid ${message.type === "ok" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
              color: message.type === "ok" ? "#10b981" : "#ef4444",
              fontSize: "0.875rem",
            }}>
              {message.text}
            </div>
          )}

          {/* Ações */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <Save size={14} />
              {saving ? "Salvando..." : "Salvar configuração"}
            </button>

            <button
              onClick={handleRunNow}
              disabled={running}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {running ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={14} />}
              {running ? "Executando..." : "Fazer backup agora"}
            </button>

            <button
              onClick={handleExport}
              className="btn btn-secondary"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <Download size={14} />
              Baixar JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
