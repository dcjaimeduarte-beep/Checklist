import React, { useRef, useState } from "react";
import { listarClientes, buscarJaEnviados, type Cliente } from "../services/api";
import { api } from "../services/api";

const MES_ATUAL = new Date().toISOString().slice(0, 7);

const EXTENSOES = new Set(["pdf", "xml", "xlsx", "docx", "csv", "zip"]);

// Mesma lógica do backend: normaliza nome removendo acentos, caracteres especiais
function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}


// Palavras que não identificam o cliente individualmente
const IGNORAR_PALAVRAS = new Set([
  "LTDA","EIRELI","ME","EPP","SA","SS","SOCIEDADE","EMPRESA",
  "COMERCIO","SERVICOS","DE","DA","DO","DAS","DOS","E","EM","COM",
]);

function palavrasChave(norm: string): string[] {
  return norm.split("_").filter(p => p.length > 2 && !IGNORAR_PALAVRAS.has(p) && !/^\d+$/.test(p));
}

// Match exato: arquivo contém o nome normalizado do cliente
// Match flexível: todas as palavras-chave do cliente aparecem no nome do arquivo
function arquivoCasaComCliente(fileNorm: string, clienteNorm: string): boolean {
  if (fileNorm.includes(clienteNorm)) return true;
  const chaves = palavrasChave(clienteNorm);
  return chaves.length >= 2 && chaves.every(p => fileNorm.includes(p));
}
interface PreviewItem {
  cliente: Cliente;
  arquivos: File[];
  status: "ok" | "sem_arquivo" | "sem_email";
}

interface ResultadoEnvio {
  clienteId: number;
  nome: string;
  status: "ok" | "erro";
  arquivos?: number;
  destinatarios?: string[];
  mensagem?: string;
}

type Filtro = "com_arquivo" | "sem_arquivo" | "sem_email" | "todos" | "selecionados" | "ja_enviado";

export function Home() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [mes, setMes]                   = useState(MES_ATUAL);
  const [pastaNome, setPastaNome]       = useState("");
  const [preview, setPreview]           = useState<PreviewItem[] | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [filtro, setFiltro]             = useState<Filtro>("com_arquivo");
  const [enviando, setEnviando]         = useState(false);
  const [resultados, setResultados]     = useState<ResultadoEnvio[] | null>(null);
  const [erro, setErro]                 = useState("");
  const [carregando, setCarregando]     = useState(false);
  const [busca, setBusca]               = useState("");
  const [totalArquivos, setTotalArquivos]           = useState(0);
  const [naoIdentificados, setNaoIdentificados]     = useState<string[]>([]);
  const [mostrarNaoIdent, setMostrarNaoIdent]       = useState(false);
  const [jaEnviados, setJaEnviados]                 = useState<Set<number>>(new Set());
  const [forcarReenvio, setForcarReenvio]           = useState(false);
  const [progresso, setProgresso]                   = useState<{ atual: number; total: number; nome: string } | null>(null);
  const [filtroResultado, setFiltroResultado]       = useState<"todos" | "ok" | "erro">("todos");

  // ── Selecionar pasta via browser ──────────────────────────────────────────

  async function handlePastaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setErro("");
    setResultados(null);
    setBusca("");
    setTotalArquivos(0);
    setNaoIdentificados([]);
    setMostrarNaoIdent(false);
    setJaEnviados(new Set());
    setForcarReenvio(false);
    setCarregando(true);

    // Nome da pasta: pega o caminho relativo do primeiro arquivo e extrai a pasta raiz
    const relative = files[0].webkitRelativePath;
    const raiz = relative.split("/")[0];
    setPastaNome(raiz);

    // Filtra apenas extensões permitidas (na raiz ou subpastas)
    const arquivosValidos = files.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return EXTENSOES.has(ext);
    });

    try {
      // Busca clientes e IDs já enviados para o mês
      const [clientes, idsJaEnviados] = await Promise.all([
        listarClientes(),
        buscarJaEnviados(mes).catch(() => [] as number[]),
      ]);
      const enviadosSet = new Set(idsJaEnviados);

      // Pré-computa quais arquivos têm correspondência exata com o nome completo de algum
      // cliente. Isso evita que o fallback de "nome base" atribua o arquivo de uma unidade
      // (ex: "SANTOS & GUEDES - BOA VISTA") a outras unidades da mesma empresa.
      const filesWithFullMatch = new Set<string>();
      clientes.forEach(c => {
        if (c.emails.length === 0) return;
        const raw   = (c.nomePasta || c.nome) as string;
        const limpo = raw.replace(/\s+\d{8,}\s*$/, "").trim();
        const norm  = normalizarNome(limpo);
        arquivosValidos.forEach(f => {
          const fileNorm = normalizarNome(f.name.replace(/\.[^.]+$/, ""));
          if (fileNorm.includes(norm)) filesWithFullMatch.add(f.name);
        });
      });

      const itens: PreviewItem[] = clientes.map(cliente => {
        if (cliente.emails.length === 0) {
          return { cliente, arquivos: [], status: "sem_email" as const };
        }
        const nomePastaRaw = (cliente.nomePasta || cliente.nome) as string;
        // Remove CPF/CNPJ numérico colado ao final (" 06540741430")
        const nomeLimpo = nomePastaRaw.replace(/\s+\d{8,}\s*$/, "").trim();
        // Nome completo normalizado
        const clienteNorm = normalizarNome(nomeLimpo);
        // Nome base: parte antes de " - NOME FANTASIA" (muito comum em empresas BR)
        // Ex: "CICERA FERREIRA DA SILVA MERCEARIA - MERC. DO BOLA" → "CICERA FERREIRA DA SILVA MERCEARIA"
        const nomeBase = nomeLimpo.replace(/\s*[-–]\s*.+$/, "").trim();
        const clienteNormBase = nomeBase !== nomeLimpo ? normalizarNome(nomeBase) : null;

        const matched = arquivosValidos.filter(f => {
          const fileNorm = normalizarNome(f.name.replace(/\.[^.]+$/, ""));
          return arquivoCasaComCliente(fileNorm, clienteNorm)
            // Fallback de nome base só se nenhum cliente já "reivindicou" o arquivo pelo nome completo
            || (clienteNormBase !== null && !filesWithFullMatch.has(f.name) && arquivoCasaComCliente(fileNorm, clienteNormBase));
        });

        return {
          cliente,
          arquivos: matched,
          status: matched.length > 0 ? ("ok" as const) : ("sem_arquivo" as const),
        };
      });

      const comArquivo = new Set(
        itens.filter(i => i.status === "ok" && !enviadosSet.has(i.cliente.id)).map(i => i.cliente.id)
      );

      const arquivosUsados = new Set(itens.flatMap(i => i.arquivos.map(f => f.name)));
      const naoIdent = arquivosValidos
        .filter(f => !arquivosUsados.has(f.name))
        .map(f => f.name);

      setTotalArquivos(arquivosValidos.length);
      setNaoIdentificados(naoIdent);
      setJaEnviados(enviadosSet);
      setPreview(itens);
      setSelecionados(comArquivo);
      setFiltro("com_arquivo");
    } catch {
      setErro("Não foi possível carregar a lista de clientes.");
    } finally {
      setCarregando(false);
    }
  }

  // ── Seleção ───────────────────────────────────────────────────────────────

  const termoBusca = busca.trim().toLowerCase();

  const itensFiltrados = (preview ?? []).filter(item => {
    if (filtro === "com_arquivo"  && item.status !== "ok")          return false;
    if (filtro === "sem_arquivo"  && item.status !== "sem_arquivo") return false;
    if (filtro === "sem_email"    && item.status !== "sem_email")   return false;
    if (filtro === "selecionados" && !selecionados.has(item.cliente.id)) return false;
    if (filtro === "ja_enviado"   && !jaEnviados.has(item.cliente.id))   return false;
    if (!termoBusca) return true;
    const nomeOk = item.cliente.nome.toLowerCase().includes(termoBusca);
    const cnpjOk = (item.cliente.cnpj ?? "").toLowerCase().includes(termoBusca);
    return nomeOk || cnpjOk;
  });

  const selecionaveisVisiveis = itensFiltrados
    .filter(i => i.status === "ok" && (forcarReenvio || !jaEnviados.has(i.cliente.id)))
    .map(i => i.cliente.id);

  const todosMarcados =
    selecionaveisVisiveis.length > 0 &&
    selecionaveisVisiveis.every(id => selecionados.has(id));

  function toggleTodos() {
    const novo = new Set(selecionados);
    if (todosMarcados) {
      selecionaveisVisiveis.forEach(id => novo.delete(id));
    } else {
      selecionaveisVisiveis.forEach(id => novo.add(id));
    }
    setSelecionados(novo);
  }

  function toggleCliente(id: number) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  }

  // ── Envio ─────────────────────────────────────────────────────────────────

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || selecionados.size === 0) return;

    setEnviando(true);
    setResultados(null);
    setErro("");

    const itensSelecionados = preview.filter(i => selecionados.has(i.cliente.id));
    const acumulados: ResultadoEnvio[] = [];

    // Agrupa clientes pelo conjunto de e-mails: mesma caixa → um único envio com todos os arquivos
    const emailGroups: Array<{ key: string; itens: typeof itensSelecionados }> = [];
    for (const item of itensSelecionados) {
      const key = [...item.cliente.emails].sort().join("|");
      const grupo = emailGroups.find(g => g.key === key);
      if (grupo) grupo.itens.push(item);
      else emailGroups.push({ key, itens: [item] });
    }

    const totalGrupos = emailGroups.length;

    for (let i = 0; i < totalGrupos; i++) {
      const grupo = emailGroups[i];
      const nomes = grupo.itens.map(it => it.cliente.nome).join(" + ");
      setProgresso({ atual: i + 1, total: totalGrupos, nome: nomes });

      const formData = new FormData();
      formData.append("mes", mes);
      formData.append("mapeamento", JSON.stringify(
        grupo.itens.map(it => ({
          clienteId: it.cliente.id,
          arquivos:  it.arquivos.map(f => f.name),
        }))
      ));
      formData.append("forceResend", String(forcarReenvio));
      for (const it of grupo.itens) {
        for (const f of it.arquivos) {
          formData.append("arquivos", f, f.name);
        }
      }

      try {
        const { data } = await api.post<{
          resultados: ResultadoEnvio[];
        }>("/envios/lote-upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        });
        acumulados.push(...data.resultados);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { erro?: string } } })
          ?.response?.data?.erro ?? "Erro de conexão";
        for (const it of grupo.itens) {
          acumulados.push({ clienteId: it.cliente.id, nome: it.cliente.nome, status: "erro", mensagem: msg });
        }
      }
    }

    setProgresso(null);
    setResultados(acumulados);
    setFiltroResultado("todos");
    setSelecionados(new Set());
    const recemEnviados = acumulados.filter(r => r.status === "ok").map(r => r.clienteId);
    setJaEnviados(prev => new Set([...prev, ...recemEnviados]));
    setEnviando(false);
  }

  function gerarRelatorio() {
    if (!preview || !resultados) return;

    const resultadosMap = new Map(resultados.map(r => [r.clienteId, r]));
    const formatarMes = (m: string) => {
      const nomes = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
      const [ano, num] = m.split("-");
      return `${nomes[parseInt(num,10)-1]}/${ano}`;
    };

    const linhas: string[][] = [[
      "Cliente", "CNPJ", "E-mails", "Status", "Qtd. Arquivos", "Observação"
    ]];

    for (const item of preview) {
      const r = resultadosMap.get(item.cliente.id);
      let status: string;
      let qtd = "";
      let obs = "";

      if (r) {
        if (r.status === "ok") {
          status = "Enviado";
          qtd = String(r.arquivos ?? "");
          obs = r.destinatarios?.join("; ") ?? "";
        } else {
          status = "Erro no envio";
          obs = r.mensagem ?? "";
        }
      } else if (jaEnviados.has(item.cliente.id)) {
        status = "Já enviado (sessão anterior)";
      } else if (item.status === "sem_email") {
        status = "Sem e-mail cadastrado";
      } else if (item.status === "sem_arquivo") {
        status = `Sem arquivo em ${formatarMes(mes)}`;
      } else {
        status = "Pendente (não selecionado)";
        qtd = String(item.arquivos.length);
      }

      linhas.push([
        item.cliente.nome,
        item.cliente.cnpj ?? "",
        item.cliente.emails.join("; "),
        status,
        qtd,
        obs,
      ]);
    }

    const csv = "﻿" + linhas
      .map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-envio-${mes}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const resumo = preview
    ? {
        ok:         preview.filter(i => i.status === "ok").length,
        semArquivo: preview.filter(i => i.status === "sem_arquivo").length,
        semEmail:   preview.filter(i => i.status === "sem_email").length,
        total:      preview.length,
      }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 960, margin: "0 auto" }}>

      <div>
        <h1 className="card__title">Envio de Documentos</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Selecione a pasta com os arquivos do mês. O sistema identifica automaticamente quais arquivos pertencem a cada cliente.
        </p>
      </div>

      {/* Painel de seleção */}
      <div className="card">
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "0 0 auto" }}>
            <label className="form-label" htmlFor="mes">Mês de referência</label>
            <input
              id="mes"
              type="month"
              className="form-input"
              style={{ width: 180 }}
              value={mes}
              onChange={e => { setMes(e.target.value); setPreview(null); setResultados(null); }}
              disabled={enviando}
            />
          </div>

          {/* Input de pasta oculto — ativado pelo botão */}
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory não está nos tipos padrão
            webkitdirectory="true"
            multiple
            style={{ display: "none" }}
            onChange={handlePastaChange}
            disabled={enviando}
          />

          <button
            className="btn btn--primary"
            style={{ height: 42 }}
            onClick={() => { if (inputRef.current) { inputRef.current.value = ""; inputRef.current.click(); } }}
            disabled={enviando || carregando}
          >
            {carregando ? "Lendo arquivos..." : "Procurar pasta"}
          </button>

          {pastaNome && !carregando && (
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", alignSelf: "center" }}>
              📁 {pastaNome}{totalArquivos > 0 ? ` — ${totalArquivos} arquivo(s) lido(s)` : ""}
            </span>
          )}
        </div>

        {erro && (
          <div className="alert alert--error" style={{ marginTop: "var(--space-4)" }}>
            <div className="alert__title">Erro</div>{erro}
          </div>
        )}
      </div>

      {/* Preview dos clientes x arquivos */}
      {resumo && preview && (
        <form onSubmit={handleEnviar} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>

          {/* Cartões de resumo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-3)" }}>
            {([
              { label: "Com arquivos", valor: resumo.ok,           cor: "var(--color-teal)",       f: "com_arquivo"  as Filtro },
              { label: "Já enviados",  valor: jaEnviados.size,     cor: "#2563eb",                 f: "ja_enviado"   as Filtro },
              { label: "Sem arquivo",  valor: resumo.semArquivo,   cor: "var(--color-text-muted)", f: "sem_arquivo"  as Filtro },
              { label: "Sem e-mail",   valor: resumo.semEmail,     cor: "var(--color-error-text)", f: "sem_email"    as Filtro },
              { label: "Selecionados", valor: selecionados.size,   cor: "#7c3aed",                 f: "selecionados" as Filtro },
              { label: "Total",        valor: resumo.total,        cor: "var(--color-navy)",       f: "todos"        as Filtro },
            ] as const).map(c => (
              <button
                key={c.f}
                type="button"
                onClick={() => setFiltro(c.f)}
                className="card"
                style={{
                  textAlign: "center", cursor: "pointer", padding: "var(--space-4)",
                  outline: filtro === c.f ? `2px solid ${c.cor}` : "none",
                  outlineOffset: 2,
                }}
              >
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.cor }}>{c.valor}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>

          {/* Arquivos não identificados */}
          {naoIdentificados.length > 0 && (
            <div className="alert alert--warning" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div className="alert__title" style={{ margin: 0 }}>
                  ⚠ {naoIdentificados.length} arquivo(s) não identificado(s) — nenhum cliente corresponde ao nome
                </div>
                <button
                  type="button"
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}
                  onClick={() => setMostrarNaoIdent(v => !v)}
                >
                  {mostrarNaoIdent ? "Ocultar" : "Ver arquivos"}
                </button>
              </div>
              {mostrarNaoIdent && (
                <ul style={{ margin: 0, paddingLeft: "var(--space-5)", fontSize: "var(--font-size-sm)" }}>
                  {naoIdentificados.map(n => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Tabela */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Barra superior */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-bg)",
              gap: "var(--space-3)", flexWrap: "wrap",
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={toggleTodos}
                  disabled={selecionaveisVisiveis.length === 0}
                  style={{ width: 16, height: 16, accentColor: "var(--color-teal)", cursor: "pointer" }}
                />
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 500 }}>
                  {selecionados.size === 0
                    ? "Selecionar todos"
                    : `${selecionados.size} selecionado${selecionados.size !== 1 ? "s" : ""}`}
                </span>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer", fontSize: "var(--font-size-sm)" }}>
                <input
                  type="checkbox"
                  checked={forcarReenvio}
                  onChange={e => setForcarReenvio(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#2563eb", cursor: "pointer" }}
                />
                <span style={{ color: "#2563eb", fontWeight: 500 }}>Forçar reenvio</span>
              </label>

              <input
                type="search"
                className="form-input"
                placeholder="Buscar por nome ou CNPJ..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{ width: 200, height: 36 }}
              />

              <button
                type="submit"
                className="btn btn--primary"
                disabled={selecionados.size === 0 || enviando}
              >
                {enviando
                  ? "Enviando..."
                  : `Enviar para ${selecionados.size} cliente${selecionados.size !== 1 ? "s" : ""}`}
              </button>
            </div>

            {itensFiltrados.length === 0 ? (
              <p style={{ padding: "var(--space-6)", color: "var(--color-gray)", textAlign: "center" }}>
                Nenhum cliente nesta categoria.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Cliente</th>
                    <th>Arquivos encontrados</th>
                    <th style={{ width: 110, textAlign: "center" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map(item => (
                    <tr
                      key={item.cliente.id}
                      style={{
                        cursor: (item.status === "ok" && (forcarReenvio || !jaEnviados.has(item.cliente.id))) ? "pointer" : "default",
                        opacity: item.status !== "ok" ? 0.55 : 1,
                      }}
                      onClick={() => item.status === "ok" && (forcarReenvio || !jaEnviados.has(item.cliente.id)) && toggleCliente(item.cliente.id)}
                    >
                      <td style={{ textAlign: "center" }}>
                        {item.status === "ok" && (
                          <input
                            type="checkbox"
                            checked={selecionados.has(item.cliente.id)}
                            onChange={() => toggleCliente(item.cliente.id)}
                            onClick={e => e.stopPropagation()}
                            disabled={!forcarReenvio && jaEnviados.has(item.cliente.id)}
                            style={{ width: 16, height: 16, accentColor: "var(--color-teal)", cursor: "pointer" }}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.cliente.nome}</div>
                        {item.cliente.emails.length > 0 && (
                          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>
                            {item.cliente.emails.join(", ")}
                          </div>
                        )}
                      </td>
                      <td>
                        {item.arquivos.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {item.arquivos.map(f => (
                              <span key={f.name} style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                                📎 {f.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {item.status === "ok" && jaEnviados.has(item.cliente.id) && <span className="badge" style={{ background: "#dbeafe", color: "#1d4ed8" }}>Já enviado</span>}
                        {item.status === "ok" && !jaEnviados.has(item.cliente.id) && <span className="badge badge--success">Pronto</span>}
                        {item.status === "sem_arquivo"  && <span className="badge badge--neutral">Sem arquivo</span>}
                        {item.status === "sem_email"    && <span className="badge badge--error">Sem e-mail</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Barra de progresso — visível durante o envio */}
          {progresso && (
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--color-navy)" }}>
                  Enviando {progresso.atual} de {progresso.total}
                </span>
                <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                  {Math.round((progresso.atual / progresso.total) * 100)}%
                </span>
              </div>
              <div style={{
                height: 8, borderRadius: 99,
                background: "var(--color-border)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${(progresso.atual / progresso.total) * 100}%`,
                  background: "var(--color-teal)",
                  borderRadius: 99,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--color-text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {progresso.nome}
              </div>
            </div>
          )}

          {/* Resultado do envio — aparece abaixo da tabela, dentro do mesmo form */}
          {resultados && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
                <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 600, color: "var(--color-navy)" }}>
                  Resultado do envio
                </h2>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <button type="button" className="btn btn--secondary" onClick={gerarRelatorio}>
                    ⬇ Baixar Relatório
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={() => setResultados(null)}>
                    Fechar resultado
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                {([
                  { label: "Enviados", valor: resultados.filter(r => r.status === "ok").length,   cor: "var(--color-teal)",       f: "ok"   as const },
                  { label: "Erros",    valor: resultados.filter(r => r.status === "erro").length, cor: "var(--color-error-text)", f: "erro" as const },
                ] as const).map(c => (
                  <button
                    key={c.f}
                    type="button"
                    onClick={() => setFiltroResultado(prev => prev === c.f ? "todos" : c.f)}
                    className="card"
                    style={{
                      flex: 1, textAlign: "center", cursor: "pointer", padding: "var(--space-4)",
                      outline: filtroResultado === c.f ? `2px solid ${c.cor}` : "none",
                      outlineOffset: 2,
                    }}
                  >
                    <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.cor }}>{c.valor}</div>
                    <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{c.label}</div>
                  </button>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Destinatários</th>
                      <th style={{ textAlign: "center" }}>Arquivos</th>
                      <th style={{ textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.filter(r => filtroResultado === "todos" || r.status === filtroResultado).map(r => (
                      <tr key={r.clienteId}>
                        <td style={{ fontWeight: 500 }}>{r.nome}</td>
                        <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                          {r.destinatarios?.join(", ") ?? r.mensagem ?? "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>{r.arquivos ?? "—"}</td>
                        <td style={{ textAlign: "center" }}>
                          {r.status === "ok"
                            ? <span className="badge badge--success">Enviado</span>
                            : <span className="badge badge--error" title={r.mensagem}>Erro</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
