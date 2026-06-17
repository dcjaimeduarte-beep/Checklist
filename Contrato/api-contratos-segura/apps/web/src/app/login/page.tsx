"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, setToken } from "@/lib/api";

type Mode = "login" | "register" | "forgot";

function SevenLogoLarge() {
  return (
    <div style={{ background: "#ffffff", borderRadius: 20, padding: "1.5rem 2rem", boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/seven-vertical.png" alt="Seven Sistemas de Automação" style={{ height: 120, width: "auto", display: "block" }} />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email,    setEmail]    = useState("");
  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function switchMode(m: Mode) {
    setMode(m); setError(""); setSuccess(""); setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const res = await apiFetch<{ accessToken: string }>("/auth/login", {
          method: "POST", body: JSON.stringify({ email, password }), auth: false,
        });
        setToken(res.accessToken);
        router.push("/dashboard");

      } else if (mode === "register") {
        const res = await apiFetch<{ accessToken: string }>("/auth/register", {
          method: "POST", body: JSON.stringify({ name, email, password }), auth: false,
        });
        setToken(res.accessToken);
        router.push("/dashboard");

      } else {
        await apiFetch("/auth/forgot-password", {
          method: "POST", body: JSON.stringify({ email }), auth: false,
        });
        setSuccess("Se este e-mail estiver cadastrado, você receberá as instruções em breve.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    login:    { title: "Bem-vindo de volta",    subtitle: "Acesse o sistema com suas credenciais" },
    register: { title: "Criar conta",           subtitle: "Preencha seus dados para se cadastrar" },
    forgot:   { title: "Esqueci minha senha",   subtitle: "Informe seu e-mail para receber o link de redefinição" },
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <div className="login-left-panel" style={{ width: "420px", flexShrink: 0, background: "#0d1f30", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
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

      <div className="login-right-panel" style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div className={mounted ? "login-card-enter" : ""} style={{ width: "100%", maxWidth: "360px", opacity: mounted ? 1 : 0 }}>

          <div className="login-logo-mobile" style={{ flexDirection: "column", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "1rem 1.25rem", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seven-vertical.png" alt="Seven" style={{ height: 80, width: "auto" }} />
            </div>
          </div>

          <div className="login-form-card" style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0D2235", margin: 0 }}>
              {titles[mode].title}
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#8B9EB0", marginTop: "0.25rem" }}>
              {titles[mode].subtitle}
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>

              {mode === "register" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>Nome completo</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="login-input"
                    style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", background: "#fff", outline: "none", boxSizing: "border-box" }}
                    placeholder="Seu nome" autoComplete="name" />
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>E-mail</label>
                <input type={mode === "login" ? "text" : "email"} value={email} onChange={(e) => setEmail(e.target.value)} required className="login-input"
                  style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", background: "#fff", outline: "none", boxSizing: "border-box" }}
                  placeholder={mode === "login" ? "seu@email.com ou seu nome" : "seu@email.com"} autoComplete="username" />
              </div>

              {mode !== "forgot" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>Senha</label>
                  <div style={{ position: "relative" }}>
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="login-input"
                      style={{ width: "100%", padding: "0.625rem 2.5rem 0.625rem 0.875rem", fontSize: "0.875rem", background: "#fff", outline: "none", boxSizing: "border-box" }}
                      placeholder={mode === "register" ? "Mínimo 8 caracteres" : "••••••••"} autoComplete={mode === "register" ? "new-password" : "current-password"} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}
                      style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8B9EB0", display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p style={{ fontSize: "0.75rem", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "0.5rem 0.75rem", margin: 0 }}>{error}</p>
              )}
              {success && (
                <p style={{ fontSize: "0.75rem", color: "#0F7A6B", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "6px", padding: "0.5rem 0.75rem", margin: 0 }}>{success}</p>
              )}

              <button type="submit" disabled={loading} className="login-btn"
                style={{ width: "100%", padding: "0.75rem", fontSize: "0.9375rem", fontWeight: 600, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                {loading ? <><span className="login-spinner" /> Aguarde...</> : mode === "login" ? "Entrar" : mode === "register" ? "Criar conta" : "Enviar link"}
              </button>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1.25rem", textAlign: "center" }}>
              {mode === "login" && (
                <>
                  <button type="button" onClick={() => switchMode("forgot")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "#1B7A8C", fontWeight: 500 }}>
                    Esqueci minha senha
                  </button>
                  <button type="button" onClick={() => switchMode("register")}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "#8B9EB0" }}>
                    Não tem conta? <span style={{ color: "#1B7A8C", fontWeight: 600 }}>Cadastre-se</span>
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button type="button" onClick={() => switchMode("login")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "#8B9EB0" }}>
                  Já tem conta? <span style={{ color: "#1B7A8C", fontWeight: 600 }}>Entrar</span>
                </button>
              )}
            </div>
          </div>

          <p className="login-copyright" style={{ textAlign: "center", fontSize: "0.75rem", color: "#8B9EB0", marginTop: "1rem" }}>
            © 2026 Seven Sistemas de Automação
          </p>
        </div>
      </div>
    </div>
  );
}
