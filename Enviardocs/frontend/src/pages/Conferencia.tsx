import { useRef, useState, type ReactNode } from "react";
import {
  listarClientes,
  listarClientesInativos,
  buscarJaEnviados,
  buscarArquivosEnviados,
  type Cliente,
} from "../services/api";
import { casarArquivos, combinaExato, semDocumentoNoNome, type ItemCasado } from "../services/casarArquivos";

const EXTENSOES = new Set(["pdf", "xml", "xlsx", "docx", "csv", "zip"]);
const MES_ATUAL = new Date().toISOString().slice(0, 7);

type Filtro = "atencao" | "prontos" | "enviados" | "sem_arquivo" | "sem_email" | "sem_cliente";

interface Analise {
  pasta: string;
  totalArquivos: number;
  itens: ItemCasado<{ name: string }>[];
  naoIdentificados: string[];
  jaEnviados: Set<number>;
  conflitos: { arquivo: string; clientes: string[] }[];
  semEmailComArquivo: { cliente: Cliente; arquivos: string[] }[];
  inativosComArquivo: { cliente: Cliente; arquivos: string[] }[];
  semDocumento: ItemCasado<{ name: string }>[];
}

function formatarCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const d = cnpj.replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return cnpj;
}

export function Conferencia() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mes, setMes] = useState(MES_ATUAL);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("atencao");
  const [busca, setBusca] = useState("");

  async function analisar(files: File[], pasta: string) {
    setCarregando(true);
    setErro("");
    try {
      const arquivos = files
        .filter(f => EXTENSOES.has(f.name.split(".").pop()?.toLowerCase() ?? ""))
        .map(f => ({ name: f.name }));

      const [clientes, inativos, idsJaEnviados, enviadosArq] = await Promise.all([
        listarClientes(),
        listarClientesInativos().catch(() => [] as Cliente[]),
        buscarJaEnviados(mes).catch(() => [] as number[]),
        buscarArquivosEnviados(mes).catch(() => ({ arquivos: [] as string[], clientesComDados: [] as number[] })),
      ]);

      const casado = casarArquivos(clientes, arquivos);
      const enviadosSet = new Set(idsJaEnviados);
      const arquivosEnviadosSet = new Set(enviadosArq.arquivos);
      const clientesComDadosSet = new Set(enviadosArq.clientesComDados);

      const comNovos = new Set<number>();
      casado.itens.forEach(i => {
        if (i.status === "ok" && enviadosSet.has(i.cliente.id) && clientesComDadosSet.has(i.cliente.id)) {
          if (i.arquivos.some(f => !arquivosEnviadosSet.has(f.name))) comNovos.add(i.cliente.id);
        }
      });
      const jaEnviados = new Set([...enviadosSet].filter(id => !comNovos.has(id)));

      const donos = new Map<string, string[]>();
      for (const item of casado.itens) {
        for (const arq of item.arquivos) {
          const lista = donos.get(arq.name) ?? [];
          lista.push(item.cliente.nome);
          donos.set(arq.name, lista);
        }
      }
      const conflitos = [...donos.entries()]
        .filter(([, nomes]) => nomes.length > 1)
        .map(([arquivo, clientesNomes]) => ({ arquivo, clientes: clientesNomes }));

      const semEmailComArquivo = casado.itens
        .filter(i => i.status === "sem_email")
        .map(i => ({
          cliente: i.cliente,
          arquivos: arquivos.filter(f => combinaExato(f.name, i.cliente)).map(f => f.name),
        }))
        .filter(i => i.arquivos.length > 0);

      const nomesSemEmail = new Set(semEmailComArquivo.flatMap(i => i.arquivos));
      const aindaSoltos = casado.naoIdentificados.filter(nome => !nomesSemEmail.has(nome));
      const inativosComArquivo = inativos
        .map(cliente => ({
          cliente,
          arquivos: aindaSoltos.filter(nome => combinaExato(nome, cliente)),
        }))
        .filter(i => i.arquivos.length > 0);

      setAnalise({
        pasta,
        totalArquivos: arquivos.length,
        itens: casado.itens,
        naoIdentificados: casado.naoIdentificados,
        jaEnviados,
        conflitos,
        semEmailComArquivo,
        inativosComArquivo,
        semDocumento: semDocumentoNoNome(casado.itens, arquivos),
      });
      setFiltro("atencao");
      setBusca("");
    } catch {
      setErro("Não foi possível ler os clientes para a conferência.");
    } finally {
      setCarregando(false);
    }
  }

  function handlePasta(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const pasta = files[0].webkitRelativePath.split("/")[0] || "pasta";
    void analisar(files, pasta);
  }

  const termo = busca.trim().toLowerCase();
  const casa = (nome: string, cnpj?: string | null) =>
    !termo || nome.toLowerCase().includes(termo) || (cnpj ?? "").toLowerCase().includes(termo);

  const prontos = analise?.itens.filter(i => i.status === "ok" && !analise.jaEnviados.has(i.cliente.id)) ?? [];
  const enviados = analise?.itens.filter(i => i.status === "ok" && analise.jaEnviados.has(i.cliente.id)) ?? [];
  const semArquivo = analise?.itens.filter(i => i.status === "sem_arquivo") ?? [];
  const semEmail = analise?.itens.filter(i => i.status === "sem_email") ?? [];
  const parciais = analise?.itens.filter(i => i.arquivos.some(f => i.matchTipo[f.name] === "parcial")) ?? [];
  const semDocumento = analise?.semDocumento ?? [];
  const atencao =
    semDocumento.length +
    (analise?.conflitos.length ?? 0) +
    parciais.length +
    (analise?.semEmailComArquivo.length ?? 0) +
    (analise?.inativosComArquivo.length ?? 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", maxWidth: 960, margin: "0 auto" }}>
      <div>
        <h1 className="card__title">Conferência antes do envio</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)" }}>
          Lê a pasta com a mesma regra da aba Envio. Mostra quem está pronto, quem está sem arquivo e o que ficaria de fora. Nada é enviado daqui.
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "0 0 auto" }}>
            <label className="form-label" htmlFor="mes-conf">Mês de referência</label>
            <input
              id="mes-conf"
              type="month"
              className="form-input"
              style={{ width: 180 }}
              value={mes}
              onChange={e => { setMes(e.target.value); setAnalise(null); }}
              disabled={carregando}
            />
          </div>
          <input
            ref={inputRef}
            type="file"
            // @ts-expect-error webkitdirectory não está nos tipos padrão
            webkitdirectory="true"
            multiple
            style={{ display: "none" }}
            onChange={handlePasta}
            disabled={carregando}
          />
          <button
            className="btn btn--primary"
            style={{ height: 42 }}
            disabled={carregando}
            onClick={() => { if (inputRef.current) { inputRef.current.value = ""; inputRef.current.click(); } }}
          >
            {carregando ? "Lendo arquivos..." : "Procurar pasta"}
          </button>
          {analise && !carregando && (
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)", alignSelf: "center" }}>
              {analise.pasta} — {analise.totalArquivos} arquivo(s)
            </span>
          )}
        </div>
        {erro && (
          <div className="alert alert--error" style={{ marginTop: "var(--space-4)" }}>
            <div className="alert__title">Erro</div>{erro}
          </div>
        )}
      </div>

      {analise && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
            {([
              { id: "atencao" as Filtro, label: "Atenção", valor: atencao, cor: "#b45309" },
              { id: "prontos" as Filtro, label: "Prontos", valor: prontos.length, cor: "var(--color-teal)" },
              { id: "enviados" as Filtro, label: "Já enviados", valor: enviados.length, cor: "#2563eb" },
              { id: "sem_arquivo" as Filtro, label: "Sem arquivo", valor: semArquivo.length, cor: semArquivo.length > 0 ? "#b45309" : "var(--color-text-muted)" },
              { id: "sem_email" as Filtro, label: "Sem e-mail", valor: semEmail.length, cor: "var(--color-error-text)" },
              { id: "sem_cliente" as Filtro, label: "Sem cliente", valor: analise.naoIdentificados.length, cor: "var(--color-navy)" },
            ]).map(c => (
              <button
                key={c.id}
                type="button"
                className="card"
                onClick={() => setFiltro(c.id)}
                style={{
                  textAlign: "center", cursor: "pointer", padding: "var(--space-4)",
                  outline: filtro === c.id ? `2px solid ${c.cor}` : "none",
                  outlineOffset: 2,
                }}
              >
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color: c.cor }}>{c.valor}</div>
                <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>

          <input
            type="search"
            className="form-input"
            placeholder="Buscar por nome ou CNPJ..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ maxWidth: 320 }}
          />

          {filtro === "atencao" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {atencao === 0 && (
                <div className="alert alert--success">Nenhum ponto fora do padrão nesta pasta.</div>
              )}
              {semDocumento.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).length > 0 && (
                <Bloco
                  titulo="Cliente ativo sem documento"
                  detalhe="Cruzamento com o cadastro ativo: nenhum arquivo desta pasta está no nome deste cliente."
                >
                  <ul style={{ margin: 0, paddingLeft: "var(--space-5)", maxHeight: 280, overflow: "auto" }}>
                    {semDocumento.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => (
                      <li key={i.cliente.id} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{i.cliente.nome}</span>
                        <span style={{ marginLeft: 8, fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                          {i.status === "sem_email" ? "sem e-mail" : i.cliente.emails.join(", ") || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Bloco>
              )}
              {analise.conflitos.length > 0 && (
                <Bloco titulo="O mesmo arquivo cairia em mais de um cliente" detalhe="No envio, os dois cadastros receberiam o anexo.">
                  {analise.conflitos.filter(c => casa(c.arquivo) || c.clientes.some(n => casa(n))).map(c => (
                    <Linha key={c.arquivo} titulo={c.arquivo} texto={c.clientes.join(" · ")} />
                  ))}
                </Bloco>
              )}
              {parciais.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).length > 0 && (
                <Bloco titulo="Nome do arquivo diferente do cadastro" detalhe="O envio associa mesmo assim, pelo trecho do nome.">
                  {parciais.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => (
                    <Linha
                      key={i.cliente.id}
                      titulo={i.cliente.nome}
                      texto={i.arquivos.filter(f => i.matchTipo[f.name] === "parcial").map(f => f.name).join(" · ")}
                    />
                  ))}
                </Bloco>
              )}
              {analise.semEmailComArquivo.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).length > 0 && (
                <Bloco titulo="Arquivo encontrado, cliente sem e-mail" detalhe="A aba Envio deixa esses arquivos como não identificados.">
                  {analise.semEmailComArquivo.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => (
                    <Linha key={i.cliente.id} titulo={i.cliente.nome} texto={i.arquivos.join(" · ")} />
                  ))}
                </Bloco>
              )}
              {analise.inativosComArquivo.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).length > 0 && (
                <Bloco titulo="Arquivo de cliente inativo" detalhe="O envio só olha clientes ativos, então o arquivo fica sem dono.">
                  {analise.inativosComArquivo.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => (
                    <Linha key={i.cliente.id} titulo={i.cliente.nome} texto={i.arquivos.join(" · ")} />
                  ))}
                </Bloco>
              )}
            </div>
          )}

          {filtro === "prontos" && (
            <TabelaClientes
              vazio="Nenhum cliente pronto para enviar."
              linhas={prontos.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => ({
                id: i.cliente.id,
                nome: i.cliente.nome,
                cnpj: i.cliente.cnpj,
                extra: i.cliente.emails.join(", "),
                arquivos: i.arquivos.map(f => f.name),
              }))}
            />
          )}

          {filtro === "enviados" && (
            <TabelaClientes
              vazio="Nenhum cliente deste mês marcado como já enviado."
              linhas={enviados.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => ({
                id: i.cliente.id,
                nome: i.cliente.nome,
                cnpj: i.cliente.cnpj,
                extra: i.cliente.emails.join(", "),
                arquivos: i.arquivos.map(f => f.name),
              }))}
            />
          )}

          {filtro === "sem_arquivo" && (
            <TabelaClientes
              vazio="Todo cliente com e-mail tem arquivo nesta pasta."
              linhas={semArquivo.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => ({
                id: i.cliente.id,
                nome: i.cliente.nome,
                cnpj: i.cliente.cnpj,
                extra: i.cliente.emails.join(", "),
                arquivos: [],
              }))}
            />
          )}

          {filtro === "sem_email" && (
            <TabelaClientes
              vazio="Nenhum cliente ativo sem e-mail."
              linhas={semEmail.filter(i => casa(i.cliente.nome, i.cliente.cnpj)).map(i => ({
                id: i.cliente.id,
                nome: i.cliente.nome,
                cnpj: i.cliente.cnpj,
                extra: "sem e-mail",
                arquivos: [],
              }))}
            />
          )}

          {filtro === "sem_cliente" && (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {analise.naoIdentificados.filter(n => casa(n)).length === 0 ? (
                <p style={{ padding: "var(--space-4)", color: "var(--color-text-muted)" }}>Nenhum arquivo sem cliente.</p>
              ) : (
                <ul style={{ margin: 0, padding: "var(--space-4) var(--space-4) var(--space-4) var(--space-6)" }}>
                  {analise.naoIdentificados.filter(n => casa(n)).map(n => {
                    const sem = analise.semEmailComArquivo.find(i => i.arquivos.includes(n));
                    const ina = analise.inativosComArquivo.find(i => i.arquivos.includes(n));
                    const motivo = sem
                      ? `Cliente sem e-mail: ${sem.cliente.nome}`
                      : ina
                        ? `Cliente inativo: ${ina.cliente.nome}`
                        : null;
                    return (
                      <li key={n}>
                        {n}
                        {motivo && <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{motivo}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Bloco({ titulo, detalhe, children }: { titulo: string; detalhe: string; children: ReactNode }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div>
        <div style={{ fontWeight: 600 }}>{titulo}</div>
        <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{detalhe}</div>
      </div>
      {children}
    </div>
  );
}

function Linha({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>
      <div style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>{titulo}</div>
      <div style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{texto}</div>
    </div>
  );
}

function TabelaClientes({ linhas, vazio }: {
  vazio: string;
  linhas: { id: number; nome: string; cnpj: string | null; extra: string; arquivos: string[] }[];
}) {
  if (linhas.length === 0) {
    return <div className="card"><p style={{ color: "var(--color-text-muted)", margin: 0 }}>{vazio}</p></div>;
  }
  return (
    <div className="card" style={{ padding: 0, overflow: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>CNPJ</th>
            <th>E-mails</th>
            <th>Arquivos</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.id}>
              <td style={{ fontWeight: 600 }}>{l.nome}</td>
              <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>{formatarCNPJ(l.cnpj) || "—"}</td>
              <td style={{ fontSize: "var(--font-size-xs)" }}>{l.extra || "—"}</td>
              <td style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)" }}>
                {l.arquivos.length > 0 ? l.arquivos.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
