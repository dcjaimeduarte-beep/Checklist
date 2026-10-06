import type { Cliente } from "./api";

export type TipoMatch = "exato" | "parcial";

export interface ItemCasado<T extends { name: string }> {
  cliente: Cliente;
  arquivos: T[];
  matchTipo: Record<string, TipoMatch>;
  chaveBusca: string;
  status: "ok" | "sem_arquivo" | "sem_email";
}

const IGNORAR_PALAVRAS = new Set([
  "LTDA", "EIRELI", "ME", "EPP", "SA", "SS", "SOCIEDADE", "EMPRESA",
  "COMERCIO", "SERVICOS", "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "COM",
]);

export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}

export function nomeParaBusca(cliente: { nome: string; nomePasta?: string | null }): string {
  const raw = (cliente.nomePasta || cliente.nome) as string;
  return raw.replace(/\s+\d{8,}\s*$/, "").trim();
}

function palavrasChave(norm: string): string[] {
  return norm.split("_").filter(p =>
    !IGNORAR_PALAVRAS.has(p) && (p.length > 2 || /^\d{1,2}$/.test(p))
  );
}

function tipoMatch(fileNorm: string, clienteNorm: string): TipoMatch | null {
  if (fileNorm.includes(clienteNorm)) return "exato";
  const chaves = palavrasChave(clienteNorm);
  if (chaves.length >= 2 && chaves.every(p => fileNorm.includes(p))) return "parcial";
  return null;
}

function normaArquivo(nome: string): string {
  return normalizarNome(nome.replace(/\.[^.]+$/, ""));
}

/** Mesma associação de arquivos usada na aba Envio. */
export function casarArquivos<T extends { name: string }>(
  clientes: Cliente[],
  arquivosValidos: T[],
): { itens: ItemCasado<T>[]; naoIdentificados: string[] } {
  const filesWithFullMatch = new Set<string>();
  clientes.forEach(c => {
    if (c.emails.length === 0) return;
    const norm = normalizarNome(nomeParaBusca(c));
    arquivosValidos.forEach(f => {
      if (normaArquivo(f.name).includes(norm)) filesWithFullMatch.add(f.name);
    });
  });

  const itens: ItemCasado<T>[] = clientes.map(cliente => {
    if (cliente.emails.length === 0) {
      return { cliente, arquivos: [], matchTipo: {}, chaveBusca: "", status: "sem_email" };
    }
    const nomeLimpo = nomeParaBusca(cliente);
    const clienteNorm = normalizarNome(nomeLimpo);
    const nomeBase = nomeLimpo.replace(/\s*[-–]\s*.+$/, "").trim();
    const clienteNormBase = nomeBase !== nomeLimpo ? normalizarNome(nomeBase) : null;

    const matched: T[] = [];
    const matchTipo: Record<string, TipoMatch> = {};

    arquivosValidos.forEach(f => {
      const fileNorm = normaArquivo(f.name);
      const t1 = tipoMatch(fileNorm, clienteNorm);
      if (t1) {
        matched.push(f);
        matchTipo[f.name] = t1;
        return;
      }
      if (clienteNormBase !== null && !filesWithFullMatch.has(f.name)) {
        const t2 = tipoMatch(fileNorm, clienteNormBase);
        if (t2) {
          matched.push(f);
          matchTipo[f.name] = t2;
        }
      }
    });

    return {
      cliente,
      arquivos: matched,
      matchTipo,
      chaveBusca: nomeLimpo,
      status: matched.length > 0 ? "ok" : "sem_arquivo",
    };
  });

  const melhorExatoPorArquivo = new Map<string, number>();
  itens.forEach(item => {
    const normLen = normalizarNome(item.chaveBusca).length;
    item.arquivos.forEach(f => {
      if (item.matchTipo[f.name] === "exato") {
        const best = melhorExatoPorArquivo.get(f.name) ?? 0;
        if (normLen > best) melhorExatoPorArquivo.set(f.name, normLen);
      }
    });
  });
  itens.forEach(item => {
    const normLen = normalizarNome(item.chaveBusca).length;
    item.arquivos = item.arquivos.filter(f => {
      const best = melhorExatoPorArquivo.get(f.name);
      if (best === undefined) return true;
      return item.matchTipo[f.name] === "exato" && normLen === best;
    });
    const mantidos = new Set(item.arquivos.map(f => f.name));
    for (const k of Object.keys(item.matchTipo)) {
      if (!mantidos.has(k)) delete item.matchTipo[k];
    }
    if (item.arquivos.length === 0 && item.status === "ok") item.status = "sem_arquivo";
  });

  const arquivosUsados = new Set(itens.flatMap(i => i.arquivos.map(f => f.name)));
  const naoIdentificados = arquivosValidos.filter(f => !arquivosUsados.has(f.name)).map(f => f.name);

  return { itens, naoIdentificados };
}

/**
 * Cliente ativo cujo nome não aparece em nenhum arquivo.
 * Quem tem e-mail segue o casamento do envio (status sem_arquivo).
 * Quem não tem e-mail não casa para envio, mas entra aqui se nenhum arquivo contém o nome.
 */
export function semDocumentoNoNome<T extends { name: string }>(
  itens: ItemCasado<T>[],
  arquivos: T[],
): ItemCasado<T>[] {
  return itens
    .filter(item => {
      if (item.status === "sem_arquivo") return true;
      if (item.status === "sem_email") {
        return !arquivos.some(f => combinaExato(f.name, item.cliente));
      }
      return false;
    })
    .sort((a, b) => a.cliente.nome.localeCompare(b.cliente.nome, "pt"));
}

export function combinaExato(nomeArquivo: string, cliente: { nome: string; nomePasta?: string | null }): boolean {
  const norm = normalizarNome(nomeParaBusca(cliente));
  if (!norm) return false;
  return normaArquivo(nomeArquivo).includes(norm);
}
