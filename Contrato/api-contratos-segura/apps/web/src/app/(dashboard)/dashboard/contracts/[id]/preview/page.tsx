"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Printer, ArrowLeft, AlertTriangle } from "lucide-react";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  SOLUTIO_ERP:  "Solutio ERP",
  GCONCILIADOR: "Gconciliador",
  SOLUTIO_WEB:  "Solutio WEB",
};
const CONTRACT_TYPE_COLORS: Record<string, string> = {
  SOLUTIO_ERP:  "#1B7A8C",
  GCONCILIADOR: "#7A5100",
  SOLUTIO_WEB:  "#0F7A6B",
};

type DocumentResponse = {
  content: string;
  templateName: string;
  contract: {
    identifier:                string | null;
    status:                    string;
    contractType:              string;
    signedAt:                  string | null;
    signedByName:              string | null;
    signedByNameContratante:   string | null;
    signedAtContratante:       string | null;
    isSigned:                  boolean;
  };
  client: { razaoSocial: string };
};

// ─── Parser texto → HTML formatado ───────────────────────────────────────────

function parseContractHTML(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { out.push('<div style="margin-bottom:0.4rem"></div>'); continue; }

    if (line.startsWith("CONTRATO DE PRESTAÇÃO")) {
      out.push(`<h1 class="ct-title">${line}</h1>`); continue;
    }
    if (line.startsWith("Contrato de Sistema de Gestão")) {
      out.push(`<p class="ct-subtitle">${line}</p>`); continue;
    }
    if (line === "Contratante" || line === "Contratada") {
      out.push(`<p class="ct-party-label">${line}</p>`); continue;
    }
    if (/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s,\/]+$/.test(line) && line.length > 2 && !line.includes("R$")) {
      out.push(`<h2 class="ct-section">${line}</h2>`); continue;
    }
    if (/^Cláusula\s+\d/.test(line)) {
      out.push(`<p class="ct-clause-label">${line}</p>`); continue;
    }
    const colonMatch = line.match(/^([^:]{1,50}):\s*(.*)$/);
    if (colonMatch && !/^https?:/.test(line) && !/^Cláusula/.test(line)) {
      const [, label, value] = colonMatch;
      if (value.trim()) {
        out.push(`<p class="ct-field"><strong class="ct-field-label">${label}:</strong> <span class="ct-field-value">${value}</span></p>`);
      } else {
        out.push(`<p class="ct-field"><strong class="ct-field-label">${label}:</strong></p>`);
      }
      continue;
    }
    out.push(`<p class="ct-text">${line}</p>`);
  }

  return out.join("\n");
}

// ─── Bloco de assinaturas ────────────────────────────────────────────────────

function fmtDatePt(iso: string) {
  const d = new Date(iso);
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}
function fmtTimePt(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function SignatureBlock({ contract, contractor, client }: {
  contract: DocumentResponse["contract"];
  contractor: string;
  client: string;
}) {
  const signed              = contract.isSigned && !!contract.signedAt;
  const dateStr             = signed ? fmtDatePt(contract.signedAt!) : fmtDatePt(new Date().toISOString());
  const timeStr             = signed ? fmtTimePt(contract.signedAt!) : "";
  const sigNameContratada   = contract.signedByName ?? "";
  const sigNameContratante  = contract.signedByNameContratante ?? "";
  const signedAtContratante = contract.signedAtContratante;

  return (
    <div style={{ marginTop: "2.5rem", fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif", padding: "0 3.5rem 3rem" }}>

      {/* Data — "Maceió, DD de Mês de AAAA" */}
      <p style={{ fontSize: "11pt", marginBottom: "3rem", color: "#1a1a1a" }}>
        <strong>Maceió,</strong> {dateStr}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", marginBottom: "3rem" }}>

        {/* Coluna da Contratada */}
        <div>
          <p style={{ fontSize: "10pt", fontWeight: 700, color: "#0D2235", margin: "0 0 6px", minHeight: "1.4em" }}>
            {sigNameContratada}
          </p>
          <div style={{ borderTop: "2px solid #0D2235", paddingTop: "0.5rem" }}>
            {signed && sigNameContratada && (
              <p style={{ fontSize: "8pt", color: "#1B7A8C", margin: "0 0 3px", fontStyle: "italic" }}>
                Assinado digitalmente em {dateStr} às {timeStr}
              </p>
            )}
            <p style={{ fontWeight: 700, fontSize: "10pt", color: "#0D2235", margin: "0 0 2px" }}>{contractor}</p>
            <p style={{ fontSize: "9pt", color: "#6B7E8C", margin: 0 }}>Contratada</p>
          </div>
        </div>

        {/* Coluna do Contratante */}
        <div>
          <p style={{ fontSize: "10pt", fontWeight: 700, color: "#0D2235", margin: "0 0 6px", minHeight: "1.4em" }}>
            {sigNameContratante}
          </p>
          <div style={{ borderTop: "2px solid #0D2235", paddingTop: "0.5rem" }}>
            {sigNameContratante && signedAtContratante && (
              <p style={{ fontSize: "8pt", color: "#1B7A8C", margin: "0 0 3px", fontStyle: "italic" }}>
                Assinado digitalmente em {fmtDatePt(signedAtContratante)} às {fmtTimePt(signedAtContratante)}
              </p>
            )}
            <p style={{ fontWeight: 700, fontSize: "10pt", color: "#0D2235", margin: "0 0 2px" }}>{client}</p>
            <p style={{ fontSize: "9pt", color: "#6B7E8C", margin: 0 }}>Contratante</p>
          </div>
        </div>
      </div>

      <p style={{ fontSize: "10pt", fontWeight: 600, color: "#333", marginBottom: "2.5rem" }}>Testemunhas:</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem" }}>
        {[1, 2].map((n) => (
          <div key={n} style={{ borderTop: "1px solid #555", paddingTop: "0.625rem" }}>
            <p style={{ fontSize: "9.5pt", margin: "0 0 4px", color: "#333" }}><strong>Nome:</strong></p>
            <p style={{ fontSize: "9.5pt", margin: 0, color: "#333" }}><strong>CPF:</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cabeçalho com logo ───────────────────────────────────────────────────────

function ContractHeader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "1.75rem 3.5rem 1.5rem",
      background: "linear-gradient(135deg, #0D2235 0%, #1A3548 100%)",
    }}>
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/seven-vertical.png"
        alt="Seven Sistemas de Automação"
        style={{ height: 52, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
        onError={(e) => {
          const el = e.currentTarget as HTMLImageElement;
          el.style.display = "none";
        }}
      />

      {/* Dados da empresa */}
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: "8.5pt", color: "rgba(255,255,255,0.9)", margin: 0, fontWeight: 600 }}>
          BARBOSA E ALMEIDA TECNOLOGIA LTDA – EPP
        </p>
        <p style={{ fontSize: "8pt", color: "rgba(255,255,255,0.5)", margin: "3px 0 0" }}>
          CNPJ: 22.510.733/0001-09
        </p>
        <p style={{ fontSize: "8pt", color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
          Maceió/AL · (82) 3027-7128
        </p>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ContractPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [doc,     setDoc]     = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    apiFetch<DocumentResponse>(`/contracts/${id}/document`)
      .then(setDoc)
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar documento."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={{ color: "var(--gray)", fontSize: "0.9375rem" }}>Gerando documento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 540, margin: "4rem auto", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: "#FEE9E9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
          <AlertTriangle size={24} style={{ color: "#C0392B" }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--navy)", marginBottom: "0.5rem" }}>
          Não foi possível gerar o documento
        </p>
        <p style={{ fontSize: "0.875rem", color: "var(--gray)", marginBottom: "1.5rem" }}>{error}</p>
        <button className="btn-primary" onClick={() => router.push("/dashboard/templates")}>
          Configurar template padrão
        </button>
      </div>
    );
  }

  const MARKER = "---ASSINATURA---";
  const parts   = doc?.content.split(MARKER) ?? ["", ""];
  const bodyHTML = parseContractHTML(parts[0].trimEnd());

  // Extrai contratada e contratante das linhas após o MARKER
  // (filtra linhas que são nomes de empresa — ignora data/assinatura digital)
  const sigLines = (parts[1] ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("_") && !l.startsWith("Assinado") && !l.match(/^\d/));

  const sigContractor = sigLines.find((l) => l.toUpperCase() === l && l.length > 5)
    ?? "BARBOSA E ALMEIDA TECNOLOGIA LTDA – EPP";
  const sigClient = doc?.client.razaoSocial ?? "";

  return (
    <>
      {/* Barra de ações — some na impressão */}
      <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button className="btn-ghost" onClick={() => router.back()} style={{ padding: "0.4rem 0.75rem" }}>
            <ArrowLeft size={15} /> Voltar
          </button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ fontWeight: 700, color: "var(--navy)", fontSize: "1rem", margin: 0 }}>{doc?.client.razaoSocial}</p>
              {doc?.contract.contractType && (
                <span style={{
                  fontSize: "0.6875rem", fontWeight: 700,
                  color: CONTRACT_TYPE_COLORS[doc.contract.contractType] ?? "#1B7A8C",
                  background: `${CONTRACT_TYPE_COLORS[doc.contract.contractType] ?? "#1B7A8C"}15`,
                  border: `1px solid ${CONTRACT_TYPE_COLORS[doc.contract.contractType] ?? "#1B7A8C"}40`,
                  borderRadius: 99, padding: "2px 8px",
                }}>
                  {CONTRACT_TYPE_LABELS[doc.contract.contractType] ?? doc.contract.contractType}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--gray)" }}>
              {doc?.templateName} · {doc?.contract.identifier ?? "Sem número"}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Documento A4 */}
      <div className="ct-document">
        <ContractHeader />
        <div className="ct-body" dangerouslySetInnerHTML={{ __html: bodyHTML }} />
        <SignatureBlock contract={doc!.contract} contractor={sigContractor} client={sigClient} />
      </div>

      <style>{`
        .ct-document {
          background: #fff;
          border-radius: 12px;
          max-width: 880px;
          margin: 0 auto;
          box-shadow: 0 4px 24px rgba(13,34,53,0.12);
          overflow: hidden;
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          font-size: 11pt;
          color: #1a1a1a;
          line-height: 1.75;
        }
        .ct-body {
          padding: 2.5rem 3.5rem 1rem;
        }
        .ct-title {
          font-size: 13.5pt;
          font-weight: 700;
          text-align: center;
          text-transform: uppercase;
          color: #0D2235;
          margin: 0 0 0.25rem;
          letter-spacing: 0.06em;
        }
        .ct-subtitle {
          text-align: center;
          font-size: 10.5pt;
          color: #4A6072;
          margin: 0 0 1.75rem;
          font-style: italic;
        }
        .ct-section {
          font-size: 9.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #fff;
          background: linear-gradient(90deg, #0D2235, #1B7A8C);
          margin: 2rem -3.5rem 0.75rem;
          padding: 0.5rem 3.5rem;
        }
        .ct-clause-label {
          font-weight: 700;
          color: #0D2235;
          margin: 1.25rem 0 0.2rem;
          font-size: 11pt;
          border-left: 3px solid #1B7A8C;
          padding-left: 0.625rem;
        }
        .ct-party-label {
          font-weight: 700;
          font-size: 10.5pt;
          color: #1B7A8C;
          margin: 1rem 0 0.15rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ct-field { margin: 0.15rem 0; font-size: 11pt; }
        .ct-field-label { color: #0D2235; font-weight: 700; }
        .ct-field-value { color: #2d2d2d; }
        .ct-text {
          text-align: justify;
          margin: 0.2rem 0;
          font-size: 11pt;
          color: #2d2d2d;
        }
        .ct-title { font-family: Arial, sans-serif; }
        .ct-subtitle { font-family: Arial, sans-serif; }
        .ct-clause-label { font-family: Arial, sans-serif; }
        .ct-party-label { font-family: Arial, sans-serif; }
        .ct-field { font-family: Arial, sans-serif; }
        .ct-text { font-family: Arial, sans-serif; }
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-hide { display: none !important; }
          .dashboard-sidebar { display: none !important; }
          .mobile-topbar { display: none !important; }
          .dashboard-main { padding: 0 !important; }
          .dashboard-layout { display: block !important; }
          .ct-document {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
          }
          .ct-body { padding: 1rem 2.5cm !important; }
          .ct-section {
            margin-left: -2.5cm !important;
            margin-right: -2.5cm !important;
            padding-left: 2.5cm !important;
            padding-right: 2.5cm !important;
          }
        }
      `}</style>
    </>
  );
}
