"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, setToken } from "@/lib/api";

function SevenLogoLarge() {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 20,
        padding: "1.5rem 2rem",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/seven-vertical.png"
        alt="Seven Sistemas de Automação"
        style={{ height: 120, width: "auto", display: "block" }}
      />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("TroqueEssaSenha123!");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      setToken(res.accessToken);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>

      {/* Painel esquerdo — navy escuro com orbs (oculto no mobile) */}
      <div
        className="login-left-panel"
        style={{
          width: "420px",
          flexShrink: 0,
          background: "#0d1f30",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", padding: "0 2.5rem" }}>
          <SevenLogoLarge />
          <p style={{ fontSize: "0.6875rem", fontWeight: 500, letterSpacing: "0.22em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: "0.5rem" }}>
            Gestão de Contratos
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div
        className="login-right-panel"
        style={{
          flex: 1,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "3rem 1.5rem",
        }}
      >
        <div
          className={mounted ? "login-card-enter" : ""}
          style={{ width: "100%", maxWidth: "360px", opacity: mounted ? 1 : 0 }}
        >
          {/* Logo no mobile (substitui o painel esquerdo) */}
          <div className="login-logo-mobile" style={{ flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.25rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seven-vertical.png" alt="Seven" style={{ height: 80, width: "auto" }} />
            </div>
            <p style={{ fontSize: "0.625rem", fontWeight: 500, letterSpacing: "0.22em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
              Gestão de Contratos
            </p>
          </div>

          {/* Cabeçalho do form */}
          <div className="login-form-card" style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0D2235", margin: 0 }}>
              Bem-vindo de volta
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#8B9EB0", marginTop: "0.25rem" }}>
              Acesse o sistema com suas credenciais
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>

              {/* E-mail ou nome */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>
                  E-mail ou nome de usuário
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input"
                  style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", background: "#fff", outline: "none", boxSizing: "border-box" }}
                  placeholder="seu@email.com ou seu nome"
                  autoComplete="username"
                />
              </div>

              {/* Senha */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>
                  Senha
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-input"
                    style={{ width: "100%", padding: "0.625rem 2.5rem 0.625rem 0.875rem", fontSize: "0.875rem", background: "#fff", outline: "none", boxSizing: "border-box" }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8B9EB0", display: "flex", alignItems: "center" }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <p style={{ fontSize: "0.75rem", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-btn"
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.9375rem", fontWeight: 600, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.25rem" }}
              >
                {loading ? (
                  <>
                    <span className="login-spinner" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          </div>

          <p className="login-copyright" style={{ textAlign: "center", fontSize: "0.75rem", color: "#8B9EB0", marginTop: "1rem" }}>
            © 2026 Seven Sistemas de Automação
          </p>
        </div>
      </div>
    </div>
  );
}
