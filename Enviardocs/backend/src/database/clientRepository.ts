/**
 * Repositório de clientes — toda interação com o banco passa por aqui.
 * Nenhum SQL fora deste arquivo.
 */
import { getDb } from './db';

export interface ClientRow {
  id: number;
  name: string;
  cnpj: string | null;
  contact_name: string | null;
  phone: string | null;
  delivery_method: string;
  regime: string | null;
  section: string;
  folder_name: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ClientEmailRow {
  id: number;
  client_id: number;
  email: string;
  is_primary: number;
}

export interface ClientWithEmails extends ClientRow {
  emails: string[];
}

// ── Consultas ──────────────────────────────────────────────────────────────

export function findAllActive(): ClientWithEmails[] {
  const db = getDb();
  const clients = db
    .prepare<[], ClientRow>('SELECT * FROM clients WHERE active = 1 ORDER BY name')
    .all();

  return clients.map(attachEmails);
}

export function findById(id: number): ClientWithEmails | null {
  const db = getDb();
  const client = db
    .prepare<[number], ClientRow>('SELECT * FROM clients WHERE id = ?')
    .get(id);
  return client ? attachEmails(client) : null;
}

export function findByName(name: string): ClientWithEmails | null {
  const db = getDb();
  const client = db
    .prepare<[string], ClientRow>(
      'SELECT * FROM clients WHERE name = ? AND active = 1 LIMIT 1',
    )
    .get(name);
  return client ? attachEmails(client) : null;
}

export function findByCnpj(cnpj: string): ClientWithEmails | null {
  const db = getDb();
  const client = db
    .prepare<[string], ClientRow>(
      'SELECT * FROM clients WHERE cnpj = ? AND active = 1 LIMIT 1',
    )
    .get(cnpj);
  return client ? attachEmails(client) : null;
}

export function searchByName(query: string): ClientWithEmails[] {
  const db = getDb();
  const clients = db
    .prepare<[string], ClientRow>(
      "SELECT * FROM clients WHERE name LIKE ? AND active = 1 ORDER BY name LIMIT 50",
    )
    .all(`%${query}%`);
  return clients.map(attachEmails);
}

// ── Mutações ───────────────────────────────────────────────────────────────

export interface CreateClientInput {
  name: string;
  cnpj?: string;
  contact_name?: string;
  phone?: string;
  delivery_method?: string;
  regime?: string;
  section?: string;
  folder_name?: string;
  notes?: string;
  emails: string[];
}

export function createClient(input: CreateClientInput): ClientWithEmails {
  const db = getDb();

  const result = db
    .prepare<[string, string | null, string | null, string | null, string, string | null, string, string | null, string | null]>(`
      INSERT INTO clients (name, cnpj, contact_name, phone, delivery_method, regime, section, folder_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.name,
      input.cnpj ?? null,
      input.contact_name ?? null,
      input.phone ?? null,
      input.delivery_method ?? 'email',
      input.regime ?? null,
      input.section ?? 'nota_fiscal',
      input.folder_name ?? null,
      input.notes ?? null,
    );

  const clientId = result.lastInsertRowid as number;
  insertEmails(clientId, input.emails);

  return findById(clientId)!;
}

export interface UpdateClientInput extends Partial<Omit<CreateClientInput, 'emails'>> {
  emails?: string[];
  active?: number;
}

export function updateClient(id: number, input: UpdateClientInput): ClientWithEmails | null {
  const db = getDb();

  const current = findById(id);
  if (!current) return null;

  db.prepare(`
    UPDATE clients SET
      name            = ?,
      cnpj            = ?,
      contact_name    = ?,
      phone           = ?,
      delivery_method = ?,
      regime          = ?,
      section         = ?,
      folder_name     = ?,
      notes           = ?,
      active          = ?,
      updated_at      = datetime('now')
    WHERE id = ?
  `).run(
    input.name             ?? current.name,
    input.cnpj             ?? current.cnpj,
    input.contact_name     ?? current.contact_name,
    input.phone            ?? current.phone,
    input.delivery_method  ?? current.delivery_method,
    input.regime           ?? current.regime,
    input.section          ?? current.section,
    input.folder_name      ?? current.folder_name,
    input.notes            ?? current.notes,
    input.active           ?? current.active,
    id,
  );

  if (input.emails !== undefined) {
    db.prepare('DELETE FROM client_emails WHERE client_id = ?').run(id);
    insertEmails(id, input.emails);
  }

  return findById(id);
}

export function deactivateClient(id: number): boolean {
  const db = getDb();
  const result = db
    .prepare("UPDATE clients SET active = 0, updated_at = datetime('now') WHERE id = ?")
    .run(id);
  return result.changes > 0;
}

// ── Log de envio ───────────────────────────────────────────────────────────

export function logSend(
  clientId: number,
  month: string,
  filesCount: number,
  status: 'success' | 'error' | 'skipped',
  errorMessage?: string,
): void {
  getDb()
    .prepare(`
      INSERT INTO send_log (client_id, month, files_count, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(clientId, month, filesCount, status, errorMessage ?? null);
}

export function getSendHistory(clientId: number): unknown[] {
  return getDb()
    .prepare('SELECT * FROM send_log WHERE client_id = ? ORDER BY sent_at DESC LIMIT 50')
    .all(clientId);
}

// ── Helpers internos ───────────────────────────────────────────────────────

function attachEmails(client: ClientRow): ClientWithEmails {
  const rows = getDb()
    .prepare<[number], ClientEmailRow>(
      'SELECT * FROM client_emails WHERE client_id = ? ORDER BY is_primary DESC, id',
    )
    .all(client.id);

  return { ...client, emails: rows.map((r) => r.email) };
}

function insertEmails(clientId: number, emails: string[]): void {
  const stmt = getDb().prepare(
    'INSERT OR IGNORE INTO client_emails (client_id, email, is_primary) VALUES (?, ?, ?)',
  );
  emails.forEach((email, idx) => stmt.run(clientId, email.toLowerCase().trim(), idx === 0 ? 1 : 0));
}
