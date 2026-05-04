/**
 * Serviço de clientes — integrado ao banco SQLite.
 * Substitui o mock original por dados reais.
 */
import { getDb } from "../database/db";
import {
  ErroClienteNaoEncontrado,
  ErroSemEmail,
} from "../middlewares/error.middleware";

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
  ativo: number;
  emails: string[];
}

// ── Consultas ──────────────────────────────────────────────────────────────

export function listarClientes(): Cliente[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, GROUP_CONCAT(e.email, ';') AS emails_raw
    FROM clients c
    LEFT JOIN client_emails e ON e.client_id = c.id
    WHERE c.active = 1
    GROUP BY c.id
    ORDER BY c.name
  `).all() as Record<string, unknown>[];

  return rows.map(mapearCliente);
}

export function buscarClientePorId(id: number): Cliente {
  const db = getDb();
  const row = db.prepare(`
    SELECT c.*, GROUP_CONCAT(e.email, ';') AS emails_raw
    FROM clients c
    LEFT JOIN client_emails e ON e.client_id = c.id
    WHERE c.id = ? AND c.active = 1
    GROUP BY c.id
  `).get(id) as Record<string, unknown> | undefined;

  if (!row) throw new ErroClienteNaoEncontrado(id);
  return mapearCliente(row);
}

export function buscarPorNome(query: string): Cliente[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, GROUP_CONCAT(e.email, ';') AS emails_raw
    FROM clients c
    LEFT JOIN client_emails e ON e.client_id = c.id
    WHERE c.name LIKE ? AND c.active = 1
    GROUP BY c.id
    ORDER BY c.name
    LIMIT 50
  `).all(`%${query}%`) as Record<string, unknown>[];

  return rows.map(mapearCliente);
}

/**
 * Resolve o cliente para envio — garante que tem e-mails cadastrados.
 */
export function resolverClienteParaEnvio(id: number): Cliente {
  const cliente = buscarClientePorId(id);
  if (cliente.emails.length === 0) throw new ErroSemEmail();
  return cliente;
}

// ── Mutações ───────────────────────────────────────────────────────────────

export interface CriarClienteInput {
  nome: string;
  cnpj?: string;
  nomeContato?: string;
  telefone?: string;
  tipoEnvio?: string;
  regime?: string;
  secao?: string;
  nomePasta?: string;
  observacoes?: string;
  emails?: string[];
}

export function criarCliente(input: CriarClienteInput): Cliente {
  const db = getDb();

  const result = db.prepare(`
    INSERT INTO clients (name, cnpj, contact_name, phone, delivery_method, regime, section, folder_name, notes)
    VALUES (@nome, @cnpj, @nomeContato, @telefone, @tipoEnvio, @regime, @secao, @nomePasta, @observacoes)
  `).run({
    nome:         input.nome,
    cnpj:         input.cnpj ?? null,
    nomeContato:  input.nomeContato ?? null,
    telefone:     input.telefone ?? null,
    tipoEnvio:    input.tipoEnvio ?? "email",
    regime:       input.regime ?? null,
    secao:        input.secao ?? "nota_fiscal",
    nomePasta:    input.nomePasta ?? null,
    observacoes:  input.observacoes ?? null,
  });

  const clienteId = result.lastInsertRowid as number;
  inserirEmails(clienteId, input.emails ?? []);

  return buscarClientePorId(clienteId);
}

export function atualizarCliente(id: number, input: Partial<CriarClienteInput>): Cliente {
  const atual = buscarClientePorId(id);
  const db = getDb();

  db.prepare(`
    UPDATE clients SET
      name            = @nome,
      cnpj            = @cnpj,
      contact_name    = @nomeContato,
      phone           = @telefone,
      delivery_method = @tipoEnvio,
      regime          = @regime,
      section         = @secao,
      folder_name     = @nomePasta,
      notes           = @observacoes,
      updated_at      = datetime('now')
    WHERE id = @id
  `).run({
    id,
    nome:         input.nome         ?? atual.nome,
    cnpj:         input.cnpj         ?? atual.cnpj,
    nomeContato:  input.nomeContato  ?? atual.nomeContato,
    telefone:     input.telefone     ?? atual.telefone,
    tipoEnvio:    input.tipoEnvio    ?? atual.tipoEnvio,
    regime:       input.regime       ?? atual.regime,
    secao:        input.secao        ?? atual.secao,
    nomePasta:    input.nomePasta    ?? atual.nomePasta,
    observacoes:  input.observacoes  ?? atual.observacoes,
  });

  if (input.emails !== undefined) {
    db.prepare("DELETE FROM client_emails WHERE client_id = ?").run(id);
    inserirEmails(id, input.emails);
  }

  return buscarClientePorId(id);
}

export function desativarCliente(id: number): void {
  const db = getDb();
  const result = db.prepare(
    "UPDATE clients SET active = 0, updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  if (result.changes === 0) throw new ErroClienteNaoEncontrado(id);
}

export function ativarCliente(id: number): void {
  const db = getDb();
  const result = db.prepare(
    "UPDATE clients SET active = 1, updated_at = datetime('now') WHERE id = ?"
  ).run(id);
  if (result.changes === 0) throw new ErroClienteNaoEncontrado(id);
}

export function listarClientesInativos(): Cliente[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, GROUP_CONCAT(e.email, ';') AS emails_raw
    FROM clients c
    LEFT JOIN client_emails e ON e.client_id = c.id
    WHERE c.active = 0
    GROUP BY c.id
    ORDER BY c.name
  `).all() as Record<string, unknown>[];
  return rows.map(mapearCliente);
}

export function registrarEnvio(
  clienteId: number,
  mes: string,
  totalArquivos: number,
  status: "success" | "error" | "skipped",
  mensagemErro?: string,
  arquivos?: string[],
): void {
  getDb().prepare(`
    INSERT INTO send_log (client_id, month, files_count, status, error_message, files_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(clienteId, mes, totalArquivos, status, mensagemErro ?? null, arquivos ? JSON.stringify(arquivos) : null);
}

export function historicoEnvios(clienteId: number): unknown[] {
  buscarClientePorId(clienteId); // lança se não existir
  return getDb().prepare(
    "SELECT * FROM send_log WHERE client_id = ? ORDER BY sent_at DESC LIMIT 50"
  ).all(clienteId);
}

export function foiEnviado(clienteId: number, mes: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM send_log WHERE client_id = ? AND month = ? AND status = 'success' LIMIT 1")
    .get(clienteId, mes);
  return row !== undefined;
}

export function jaEnviadosNoMes(mes: string): number[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT client_id FROM send_log WHERE month = ? AND status = 'success'")
    .all(mes) as { client_id: number }[];
  return rows.map(r => r.client_id);
}

export function arquivosEnviadosNoMes(mes: string): { arquivos: string[]; clientesComDados: number[] } {
  const rows = getDb()
    .prepare("SELECT client_id, files_json FROM send_log WHERE month = ? AND status = 'success' AND files_json IS NOT NULL")
    .all(mes) as { client_id: number; files_json: string }[];
  const todos: string[] = [];
  const clientesComDados: number[] = [];
  for (const row of rows) {
    try {
      todos.push(...(JSON.parse(row.files_json) as string[]));
      clientesComDados.push(row.client_id);
    } catch { /* ignora */ }
  }
  return { arquivos: [...new Set(todos)], clientesComDados: [...new Set(clientesComDados)] };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function inserirEmails(clienteId: number, emails: string[]): void {
  const stmt = getDb().prepare(
    "INSERT OR IGNORE INTO client_emails (client_id, email, is_primary) VALUES (?, ?, ?)"
  );
  emails.forEach((email, idx) =>
    stmt.run(clienteId, email.toLowerCase().trim(), idx === 0 ? 1 : 0)
  );
}

function mapearCliente(row: Record<string, unknown>): Cliente {
  const emailsRaw = (row.emails_raw as string | null) ?? "";
  const emails = emailsRaw ? emailsRaw.split(";").filter(Boolean) : [];

  return {
    id:          row.id as number,
    nome:        row.name as string,
    cnpj:        row.cnpj as string | null,
    nomeContato: row.contact_name as string | null,
    telefone:    row.phone as string | null,
    tipoEnvio:   row.delivery_method as string,
    regime:      row.regime as string | null,
    secao:       row.section as string,
    nomePasta:   row.folder_name as string | null,
    observacoes: row.notes as string | null,
    ativo:       row.active as number,
    emails,
  };
}
