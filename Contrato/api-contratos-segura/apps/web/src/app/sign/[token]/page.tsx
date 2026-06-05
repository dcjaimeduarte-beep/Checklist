"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, FileText, AlertTriangle, Pen } from "lucide-react";

// Usa o proxy do Next.js (/api-backend) para funcionar tanto local quanto externamente
const API = typeof window !== "undefined"
  ? "/api-backend"
  : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333");

type ContractData = {
  id: string;
  identifier: string | null;
  clientName: string;
  clientCnpj: string | null;
  monthlyFee: number;
  startDate: string;
  content: string | null;
  expiresAt: string | null;
  signedByName:            string | null;
  signedByNameContratante: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}
function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function SignPage() {
  const { token } = useParams<{ token: string }>();

  const [contract,   setContract]   = useState<ContractData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [signerName, setSignerName] = useState("");
  const [signing,         setSigning]         = useState(false);
  const [signed,          setSigned]          = useState(false);
  const [signedAt,        setSignedAt]        = useState("");
  const [fullySignedNow,  setFullySignedNow]  = useState(false);
  const [signError,       setSignError]       = useState("");
  const [agreed,     setAgreed]     = useState(false);
  const [role,       setRole]       = useState<"contratante" | "contratada" | null>(null);

  useEffect(() => {
    fetch(`${API}/public/sign/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.message ?? "Link inválido ou expirado.");
        }
        return r.json() as Promise<ContractData>;
      })
      .then(setContract)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar contrato."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign() {
    if (!role) { setSignError("Selecione se você é o cliente ou a empresa."); return; }
    if (!signerName.trim()) { setSignError("Informe seu nome completo."); return; }
    if (!agreed) { setSignError("Confirme que leu e concorda com o contrato."); return; }
    setSigning(true);
    setSignError("");
    try {
      const r = await fetch(`${API}/public/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName: signerName.trim(), role }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message ?? "Erro ao assinar.");
      }
      const data = await r.json() as { signedAt: string; fullySignedNow: boolean };
      setSignedAt(data.signedAt);
      setFullySignedNow(data.fullySignedNow);
      setSigned(true);
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Erro ao assinar.");
    } finally {
      setSigning(false);
    }
  }

  // ── Tela de carregando ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: "center", color: "#8B9EB0", fontSize: "0.9375rem" }}>Carregando contrato...</p>
        </div>
      </div>
    );
  }

  // ── Tela de erro (link inválido) ──────────────────────────────────────────
  if (error || !contract) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", textAlign: "center" }}>
            <AlertTriangle size={40} style={{ color: "#C0392B", opacity: 0.7 }} />
            <p style={{ fontWeight: 700, color: "#0D2235", fontSize: "1.125rem" }}>Link inválido</p>
            <p style={{ color: "#8B9EB0", fontSize: "0.875rem" }}>{error || "Este link de assinatura não existe ou já expirou."}</p>
          </div>
        </div>
        <footer style={footerStyle}>Seven Sistemas de Automação</footer>
      </div>
    );
  }

  // ── Tela de assinatura concluída ──────────────────────────────────────────
  if (signed) {
    const otherRole = role === "contratante" ? "Empresa (Contratada)" : "Cliente (Contratante)";
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", textAlign: "center" }}>
            <CheckCircle2 size={52} style={{ color: "#0F7A6B" }} />
            <p style={{ fontWeight: 800, color: "#0D2235", fontSize: "1.25rem" }}>
              {fullySignedNow ? "Contrato totalmente assinado!" : "Assinatura registrada!"}
            </p>
            <p style={{ color: "#8B9EB0", fontSize: "0.875rem" }}>
              Assinado por <strong style={{ color: "#0D2235" }}>{signerName}</strong>
              {signedAt && ` em ${new Date(signedAt).toLocaleString("pt-BR")}`}.
            </p>
            {!fullySignedNow && (
              <div style={{ background: "#FFF8E6", border: "1px solid #F5C97A", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "#7A5100" }}>
                Aguardando assinatura da parte: <strong>{otherRole}</strong>.<br />
                O mesmo link pode ser usado para a outra assinatura.
              </div>
            )}
            <p style={{ fontSize: "0.8125rem", color: "#8B9EB0" }}>
              {fullySignedNow ? "Pode fechar esta página." : "Você pode fechar esta página."}
            </p>
          </div>
        </div>
        <footer style={footerStyle}>Seven Sistemas de Automação</footer>
      </div>
    );
  }

  // ── Tela principal ────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ background: "#0D2235", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: "4px 6px", display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seven-vertical.png" alt="Seven" style={{ height: 28, width: "auto" }} />
        </div>
        <div>
          <p style={{ color: "#fff", fontWeight: 700, fontSize: "0.9375rem", margin: 0 }}>Assinatura de Contrato</p>
          <p style={{ color: "rgba(139,158,176,0.7)", fontSize: "0.6875rem", margin: "2px 0 0" }}>Seven Sistemas de Automação</p>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>

        {/* Resumo do contrato */}
        <div style={{ ...cardStyle, marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
            <FileText size={18} style={{ color: "#1B7A8C" }} />
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0D2235", margin: 0 }}>
              Contrato {contract.identifier ?? contract.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            {[
              { label: "Cliente",     value: contract.clientName },
              { label: "CNPJ",        value: contract.clientCnpj ?? "—" },
              { label: "Mensalidade", value: fmtCurrency(contract.monthlyFee) },
              { label: "Início",      value: fmtDate(contract.startDate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8B9EB0", margin: "0 0 2px" }}>{label}</p>
                <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0D2235", margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
          {contract.expiresAt && (
            <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#B07A00" }}>
              Este link expira em {new Date(contract.expiresAt).toLocaleString("pt-BR")}.
            </p>
          )}
        </div>

        {/* Documento */}
        {contract.content && (
          <div style={{ ...cardStyle, marginBottom: "1.25rem" }}>
            <p style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0D2235", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Documento do Contrato
            </p>
            <div
              style={{ fontSize: "0.875rem", color: "#2D3F50", lineHeight: 1.7, maxHeight: 400, overflowY: "auto", paddingRight: "0.25rem" }}
              dangerouslySetInnerHTML={{ __html: contract.content.replace(/\n/g, "<br/>") }}
            />
          </div>
        )}

        {/* Bloco de assinatura */}
        <div style={{ ...cardStyle, borderTop: "3px solid #1B7A8C" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem" }}>
            <Pen size={16} style={{ color: "#1B7A8C" }} />
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0D2235", margin: 0 }}>Assinar digitalmente</p>
          </div>

          {/* Status das assinaturas */}
          {(contract.signedByName || contract.signedByNameContratante) && (
            <div style={{ background: "#F0F9F7", border: "1px solid #1B7A8C30", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235", marginBottom: "0.5rem" }}>Status das assinaturas</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {[
                  { label: "Empresa (Contratada)",   name: contract.signedByName },
                  { label: "Cliente (Contratante)",  name: contract.signedByNameContratante },
                ].map(({ label, name }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                    <CheckCircle2 size={14} style={{ color: name ? "#0F7A6B" : "#D8E3EA", flexShrink: 0 }} />
                    <span style={{ color: name ? "#0F7A6B" : "#8B9EB0", fontWeight: name ? 600 : 400 }}>
                      {label}{name ? `: ${name}` : " — aguardando"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seletor de papel */}
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235", marginBottom: "0.5rem" }}>
              Você está assinando como *
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {([
                { value: "contratante" as const, label: "Cliente",  sub: "Contratante", alreadySigned: !!contract.signedByNameContratante },
                { value: "contratada"  as const, label: "Empresa",  sub: "Contratada",  alreadySigned: !!contract.signedByName },
              ] as const).map(({ value, label, sub, alreadySigned }) => {
                const selected  = role === value;
                const disabled  = alreadySigned;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { if (!disabled) { setRole(value); setSignError(""); } }}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: 10,
                      border: `2px solid ${disabled ? "#D8E3EA" : selected ? "#1B7A8C" : "#D8E3EA"}`,
                      background: disabled ? "#F7FAFB" : selected ? "rgba(27,122,140,0.06)" : "#fff",
                      cursor: disabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      opacity: disabled ? 0.6 : 1,
                      transition: "all 0.15s",
                    }}
                  >
                    <p style={{ fontWeight: 700, fontSize: "0.9375rem", color: disabled ? "#8B9EB0" : selected ? "#1B7A8C" : "#0D2235", margin: "0 0 2px" }}>{label}</p>
                    <p style={{ fontSize: "0.75rem", color: "#8B9EB0", margin: 0 }}>
                      {disabled ? "Já assinou" : sub}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "#0D2235", marginBottom: "0.375rem" }}>
              Seu nome completo *
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => { setSignerName(e.target.value); setSignError(""); }}
              placeholder="Digite seu nome completo"
              style={{ width: "100%", padding: "0.625rem 0.875rem", fontSize: "0.9375rem", border: "1px solid #D8E3EA", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
            />
          </div>

          <div
            style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", marginBottom: "1.25rem", cursor: "pointer", userSelect: "none" }}
            onClick={() => { setAgreed(!agreed); setSignError(""); }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: `2px solid ${agreed ? "#1B7A8C" : "#D8E3EA"}`,
              background: agreed ? "#1B7A8C" : "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
              {agreed && <CheckCircle2 size={13} color="#fff" strokeWidth={3} />}
            </div>
            <p style={{ fontSize: "0.875rem", color: "#4A6072", margin: 0, lineHeight: 1.5 }}>
              Declaro que li e concordo com todas as cláusulas do contrato acima, e que esta assinatura eletrônica tem validade legal conforme a Lei nº 14.063/2020.
            </p>
          </div>

          {signError && (
            <p style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "#c53030", marginBottom: "1rem" }}>
              {signError}
            </p>
          )}

          <button
            onClick={handleSign}
            disabled={signing}
            style={{
              width: "100%", padding: "0.875rem", borderRadius: 10, border: "none",
              background: signing ? "#8B9EB0" : "#1B7A8C", color: "#fff",
              fontWeight: 700, fontSize: "1rem", cursor: signing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
              transition: "background 0.15s",
            }}
          >
            <Pen size={16} />
            {signing ? "Registrando assinatura..." : "Assinar contrato"}
          </button>
        </div>
      </div>

      <footer style={footerStyle}>Seven Sistemas de Automação</footer>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#F0F4F7",
  display: "flex",
  flexDirection: "column",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: "1.25rem 1.5rem",
  boxShadow: "0 2px 8px rgba(13,34,53,0.07)",
};

const footerStyle: React.CSSProperties = {
  marginTop: "auto",
  padding: "1rem",
  textAlign: "center",
  fontSize: "0.75rem",
  color: "#8B9EB0",
};
