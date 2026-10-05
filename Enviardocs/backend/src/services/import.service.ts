import XLSX from 'xlsx';

import { getDb } from '../database/db';
import { normalizarNome } from '../utils/nome.util';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface RawRow {
  name: string;
  cnpj: string;
  emails: string[];
  contato: string;
}

interface ClienteExistente {
  id: number;
  cnpj: string | null;
  contact_name: string | null;
}

export interface EmailParaRevisar {
  nome: string;
  cnpj: string;
  emailsNaBd: string[];
  emailsNaPlanilha: string[];
}

export interface ImportResult {
  inseridos: number;
  atualizados: number;
  ignorados: number;
  emailsParaRevisar: EmailParaRevisar[];
  detalhes: Array<{
    nome: string;
    cnpj: string;
    acao: 'inserido' | 'atualizado' | 'ignorado';
    motivo?: string;
  }>;
}

// ── Parsing ─────────────────────────────────────────────────────────────────

const SECTION_SEPARATOR = /clientes\s+(seven\s+)?-?\s*(boletos?|recibo)/i;
const SKIP_PATTERNS = [
  /^parceria\s*-/i,
  /^clientes\s+(nota\s+fiscal|recibo|seven)/i,
  /^cliente$/i,
];

function parseEmails(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const emails = raw
    .split(/[;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@') && e.length > 5);
  return [...new Set(emails)];
}

function shouldSkip(name: string): boolean {
  if (!name || typeof name !== 'string' || name.trim() === '') return true;
  const texto = name.trim();
  return SKIP_PATTERNS.some((p) => p.test(texto)) || SECTION_SEPARATOR.test(texto);
}

export function normalizarCnpj(raw: string | number | null | undefined): string {
  const cnpj = String(raw ?? '').trim().replace(/[.\-\/\s]/g, '');
  if (/^\d+$/.test(cnpj) && cnpj.length >= 8) return cnpj.padStart(14, '0');
  return cnpj;
}

function findColumns(data: unknown[][]): { headerRow: number; name: number; cnpj: number; email: number; contato: number } {
  for (let i = 0; i < Math.min(data.length, 20); i++) {
    const cells = (data[i] as unknown[]).map((c) => String(c ?? '').toLowerCase().trim());
    const name = cells.findIndex((c) => c === 'cliente');
    if (name < 0) continue;
    const cnpj = cells.findIndex((c) => c === 'cnpj');
    const email = cells.findIndex((c) => c === 'email' || c === 'e-mail');
    const contato = cells.findIndex((c) => c === 'contato');
    if (cnpj < 0 || email < 0) continue;
    return { headerRow: i, name, cnpj, email, contato };
  }
  // Planilha antiga: Cliente na coluna A, CNPJ na B, contato na I, e-mail na J
  return { headerRow: 4, name: 0, cnpj: 1, email: 9, contato: 8 };
}

function readSheet(ws: XLSX.WorkSheet): RawRow[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const cols = findColumns(data);
  const rows: RawRow[] = [];

  for (let i = cols.headerRow + 1; i < data.length; i++) {
    const row = data[i] as (string | number)[];
    const name = String(row[cols.name] ?? '').trim();
    if (shouldSkip(name)) continue;

    const contato = cols.contato >= 0 ? String(row[cols.contato] ?? '').trim().slice(0, 100) : '';
    rows.push({
      name,
      cnpj: normalizarCnpj(row[cols.cnpj]),
      emails: parseEmails(String(row[cols.email] ?? '').trim()),
      contato,
    });
  }

  return rows;
}

// ── Importação ──────────────────────────────────────────────────────────────

export function importarPlanilha(buffer: Buffer): ImportResult {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const allRows: RawRow[] = [];
  for (const sheetName of wb.SheetNames) {
    allRows.push(...readSheet(wb.Sheets[sheetName]));
  }

  const db = getDb();
  const result: ImportResult = { inseridos: 0, atualizados: 0, ignorados: 0, emailsParaRevisar: [], detalhes: [] };

  const existingByExact = new Map<string, ClienteExistente>();
  const existingByFlex = new Map<string, ClienteExistente>();
  const flexCount = new Map<string, number>();

  const allClients = db
    .prepare('SELECT id, name, cnpj, contact_name FROM clients')
    .all() as { id: number; name: string; cnpj: string | null; contact_name: string | null }[];

  for (const c of allClients) {
    const atual: ClienteExistente = { id: c.id, cnpj: c.cnpj, contact_name: c.contact_name };
    existingByExact.set(c.name.toUpperCase(), atual);
    const flex = normalizarNome(c.name);
    flexCount.set(flex, (flexCount.get(flex) ?? 0) + 1);
    existingByFlex.set(flex, atual);
  }
  for (const [flex, count] of flexCount) {
    if (count > 1) existingByFlex.delete(flex);
  }

  const insertClient = db.prepare(
    'INSERT INTO clients (name, cnpj, contact_name, active) VALUES (?, ?, ?, 1)'
  );
  const updateCampos = db.prepare(
    `UPDATE clients
     SET cnpj = ?, contact_name = ?, updated_at = datetime('now')
     WHERE id = ?`
  );
  const insertEmail = db.prepare(
    'INSERT OR IGNORE INTO client_emails (client_id, email, is_primary) VALUES (?, ?, ?)'
  );
  const selectEmails = db.prepare(
    'SELECT email FROM client_emails WHERE client_id = ?'
  );

  function localizar(nome: string): ClienteExistente | undefined {
    return existingByExact.get(nome.toUpperCase()) ?? existingByFlex.get(normalizarNome(nome));
  }

  db.transaction(() => {
    for (const row of allRows) {
      const existing = localizar(row.name);

      if (existing) {
        const emailsNaBd = (selectEmails.all(existing.id) as { email: string }[])
          .map((e) => e.email.trim().toLowerCase());
        const emailsNaBdSet = new Set(emailsNaBd);
        const emailsNovos = row.emails.filter((e) => !emailsNaBdSet.has(e));

        const cnpjBd = normalizarCnpj(existing.cnpj);
        const mudaCnpj = row.cnpj !== '' && cnpjBd !== row.cnpj;
        const contatoBd = (existing.contact_name ?? '').trim();
        const mudaContato = row.contato !== '' && row.contato.toLowerCase() !== contatoBd.toLowerCase();

        if (!mudaCnpj && !mudaContato && emailsNovos.length === 0) continue;

        if (mudaCnpj || mudaContato) {
          const cnpjFinal = mudaCnpj ? row.cnpj : existing.cnpj;
          const contatoFinal = mudaContato ? row.contato : existing.contact_name;
          updateCampos.run(cnpjFinal, contatoFinal, existing.id);
          existing.cnpj = cnpjFinal;
          existing.contact_name = contatoFinal;
        }

        if (emailsNovos.length > 0) {
          const jaTinhaEmail = emailsNaBd.length > 0;
          emailsNovos.forEach((email, idx) => {
            insertEmail.run(existing.id, email, !jaTinhaEmail && idx === 0 ? 1 : 0);
          });
          result.emailsParaRevisar.push({
            nome: row.name,
            cnpj: existing.cnpj || '—',
            emailsNaBd,
            emailsNaPlanilha: emailsNovos,
          });
        }

        const partes: string[] = [];
        if (mudaCnpj) partes.push(`CNPJ atualizado para ${row.cnpj}`);
        if (mudaContato) partes.push(`contato atualizado para ${row.contato}`);
        if (emailsNovos.length > 0) {
          partes.push(`e-mail adicionado: ${emailsNovos.join(', ')} (anteriores preservados)`);
        }

        result.atualizados++;
        result.detalhes.push({
          nome: row.name,
          cnpj: existing.cnpj || '—',
          acao: 'atualizado',
          motivo: partes.join('; '),
        });
        continue;
      }

      const res = insertClient.run(row.name, row.cnpj || null, row.contato || null);
      const clientId = res.lastInsertRowid as number;
      row.emails.forEach((email, idx) => insertEmail.run(clientId, email, idx === 0 ? 1 : 0));

      const criado: ClienteExistente = {
        id: clientId,
        cnpj: row.cnpj || null,
        contact_name: row.contato || null,
      };
      existingByExact.set(row.name.toUpperCase(), criado);
      const flex = normalizarNome(row.name);
      if (!existingByFlex.has(flex)) existingByFlex.set(flex, criado);

      result.inseridos++;
      result.detalhes.push({
        nome: row.name,
        cnpj: row.cnpj || '—',
        acao: 'inserido',
        motivo: row.emails.length === 0 ? 'sem e-mail na planilha' : (row.contato ? undefined : 'sem contato na planilha'),
      });
    }
  })();

  return result;
}
