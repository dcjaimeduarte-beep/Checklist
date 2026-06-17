"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [show,      setShow]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState(false);

  useEffect(() => {
    if (!token) setError("Link inválido. Solicite um novo e-mail de redefinição.");
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== password2) { setError("As senhas não coincidem."); return; }
    if (password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); return; }
    setLoading(true); setError("");
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST", body: JSON.stringify({ token, password }), auth: false,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", padding: "2.5rem", width: "100%", maxWidth: 400 }}>
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seven-vertical.png" alt="Seven" style={{ height: 64, marginBottom: "1rem" }} />
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#0D2235", margin: 0 }}>Redefinir senha</h1>
          <p style={{ fontSize: "0.875rem", color: "#8B9EB0", marginTop: "0.25rem" }}>Digite sua nova senha abaixo</p>
        </div>

        {success ? (
          <div style={{ textAlign: "center", color: "#0F7A6B", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "1rem" }}>
            Senha redefinida com sucesso! Redirecionando para o login...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>Nova senha</label>
              <div style={{ position: "relative" }}>
                <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="login-input" placeholder="Mínimo 8 caracteres"
                  style={{ width: "100%", padding: "0.625rem 2.5rem 0.625rem 0.875rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShow(v => !v)} tabIndex={-1}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8B9EB0" }}>
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235" }}>Confirmar nova senha</label>
              <input type={show ? "text" : "password"} value={password2} onChange={(e) => setPassword2(e.target.value)} required
                className="login-input" placeholder="Repita a senha"
                style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.875rem", outline: "none", boxSizing: "border-box" }} />
            </div>

            {error && (
              <p style={{ fontSize: "0.75rem", color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "0.5rem 0.75rem", margin: 0 }}>{error}</p>
            )}

            <button type="submit" disabled={loading || !token} className="login-btn"
              style={{ width: "100%", padding: "0.75rem", fontSize: "0.9375rem", fontWeight: 600, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Salvando..." : "Redefinir senha"}
            </button>

            <button type="button" onClick={() => router.push("/login")}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8125rem", color: "#8B9EB0", textAlign: "center" }}>
              Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
