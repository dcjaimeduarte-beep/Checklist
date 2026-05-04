/**
 * Cliente HTTP — axios com API key via variável de ambiente.
 *
 * ⚠️  A VITE_API_KEY fica exposta no bundle do navegador.
 *     Use este frontend apenas em rede interna/privada.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const API_KEY  = import.meta.env.VITE_API_KEY  ?? "";

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: { "x-api-key": API_KEY },
});

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface Cliente {
  id: number;
  nome: string;
  cnpj: string | null;
  nomeContato: string | null;
  telefone: string | null;
  tipoEnvio: string;
  regime: string | null;
  secao: string;
  nomePasta: string | null;
  observacoes: string | null;
  emails: string[];
}

export interface EnvioLog {
  id: number;
  cliente: string;
  month: string;
  files_count: number;
  status: "success" | "error" | "skipped";
  error_message: string | null;
  sent_at: string;
}

export interface ResumoMes {
  total: number;
  enviados: number;
  erros: number;
  arquivos: number;
}

export interface Status {
  storageDir: string;
  totalClientes: number;
  semEmail: number;
  ultimosEnvios: EnvioLog[];
  resumoMes: ResumoMes | null;
}

export type ClienteInput = Partial<Omit<Cliente, "id">> & { nome: string };

// ── Clientes ───────────────────────────────────────────────────────────────

export async function listarClientes(): Promise<Cliente[]> {
  const { data } = await api.get<{ dados: Cliente[] }>("/clientes");
  return data.dados;
}

export async function buscarClientePorNome(q: string): Promise<Cliente[]> {
  const { data } = await api.get<{ dados: Cliente[] }>("/clientes/buscar", { params: { q } });
  return data.dados;
}

export async function buscarClientePorId(id: number): Promise<Cliente> {
  const { data } = await api.get<Cliente>(`/clientes/${id}`);
  return data;
}

export async function criarCliente(input: ClienteInput): Promise<Cliente> {
  const { data } = await api.post<Cliente>("/clientes", input);
  return data;
}

export async function atualizarCliente(id: number, input: Partial<ClienteInput>): Promise<Cliente> {
  const { data } = await api.put<Cliente>(`/clientes/${id}`, input);
  return data;
}

export async function desativarCliente(id: number): Promise<void> {
  await api.delete(`/clientes/${id}`);
}

export async function ativarCliente(id: number): Promise<void> {
  await api.put(`/clientes/${id}/ativar`);
}

export async function listarClientesInativos(): Promise<Cliente[]> {
  const { data } = await api.get<{ dados: Cliente[] }>("/clientes/inativos");
  return data.dados;
}

export interface ImportDetalhe {
  nome: string;
  cnpj: string;
  acao: "inserido" | "atualizado" | "ignorado";
  motivo?: string;
}

export interface ImportResult {
  inseridos: number;
  atualizados: number;
  ignorados: number;
  detalhes: ImportDetalhe[];
}

export async function importarPlanilha(file: File): Promise<ImportResult> {
  const form = new FormData();
  form.append("planilha", file);
  const { data } = await api.post<ImportResult>("/clientes/importar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Configurações ──────────────────────────────────────────────────────────

export interface Template {
  assunto: string;
  corpo: string;
  defaults: { assunto: string; corpo: string };
}

export async function buscarTemplate(): Promise<Template> {
  const { data } = await api.get<Template>("/config/template");
  return data;
}

export async function salvarTemplate(assunto: string, corpo: string): Promise<void> {
  await api.put("/config/template", { assunto, corpo });
}

// ── Status / Dashboard ─────────────────────────────────────────────────────

export async function buscarStatus(mes?: string): Promise<Status> {
  const { data } = await api.get<Status>("/status", { params: mes ? { mes } : {} });
  return data;
}

// ── Envios ─────────────────────────────────────────────────────────────────

export async function enviarDocumentos(clienteId: number, mes?: string) {
  const { data } = await api.post("/envios/cliente", { clienteId, mes });
  return data as {
    sucesso: boolean;
    mensagem: string;
    cliente: { id: number; nome: string };
    destinatarios: string[];
    arquivos: string[];
  };
}

export type StatusPreview = "ok" | "sem_arquivo" | "sem_email";

export interface PreviewItem {
  cliente: Cliente;
  arquivos: string[];
  status: StatusPreview;
}

export interface PreviewResult {
  mes: string;
  resumo: { ok: number; semArquivo: number; semEmail: number; total: number };
  resultados: PreviewItem[];
}

export async function previewEnvios(mes: string): Promise<PreviewResult> {
  const { data } = await api.get<PreviewResult>("/envios/preview", { params: { mes } });
  return data;
}

export interface ResultadoLote {
  clienteId: number;
  nome: string;
  status: "ok" | "erro";
  arquivos?: number;
  destinatarios?: string[];
  mensagem?: string;
}

export interface RespostaLote {
  mes: string;
  total: number;
  enviados: number;
  erros: number;
  resultados: ResultadoLote[];
}

export async function enviarLote(mes: string, clienteIds: number[]): Promise<RespostaLote> {
  const { data } = await api.post<RespostaLote>("/envios/lote", { mes, clienteIds });
  return data;
}

export async function buscarJaEnviados(mes: string): Promise<number[]> {
  const { data } = await api.get<{ mes: string; clienteIds: number[] }>("/envios/enviados", { params: { mes } });
  return data.clienteIds;
}
