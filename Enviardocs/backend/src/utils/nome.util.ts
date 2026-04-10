/**
 * Normaliza nomes de clientes para busca em arquivos.
 * Remove acentos, substitui espaços por _ e converte para maiúsculas.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toUpperCase();
}
