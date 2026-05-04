import XLSX from 'xlsx';
import { getDb } from '../database/db';

// ── Tipos ───────────────────────────────────────────────────────────────────

interface RawRow {
  name: string;
  cnpj: string;
  emails: string[];
}

export interface ImportResult {
  inseridos: number;
  atualizados: number;
  ignorados: number;
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
  return raw
    .split(/[;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@') && e.length > 5);
}

function shouldSkip(name: string): boolean {
  if (!name || typeof name !== 'string' || name.trim() === '') return true;
  return SKIP_PATTERNS.some((p) => p.test(name.trim()));
}

function readSheet(ws: XLSX.WorkSheet): RawRow[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const rows: RawRow[] = [];

  // Localiza cabeçalho
  let dataStart = 5;
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i] as string[];
    if (String(row[0]).toLowerCase().trim() === 'cliente') {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < data.length; i++) {
    const row = data[i] as (string | number)[];
    const name = String(row[0] ?? '').trim();

    if (SECTION_SEPARATOR.test(name) || SECTION_SEPARATOR.test(String(row[2] ?? ''))) continue;
    if (shouldSkip(name)) continue;

    const emailRaw = String(row[9] ?? '').trim();
    const emails   = parseEmails(emailRaw);

    // Remove formatação (pontos, barras, hífens) antes de normalizar
    let cnpj = String(row[1] ?? '').trim().replace(/[.\-\/]/g, '');
    if (/^\d+$/.test(cnpj) && cnpj.length >= 8) {
      cnpj = cnpj.padStart(14, '0');
    }

    rows.push({ name, cnpj, emails });
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
  const result: ImportResult = { inseridos: 0, atualizados: 0, ignorados: 0, detalhes: [] };

  // Carrega índice de clientes existentes — nome é o identificador principal
  const existingByName = new Map<string, number>();

  const allClients = db
    .prepare('SELECT id, name FROM clients')
    .all() as { id: number; name: string }[];

  for (const c of allClients) {
    existingByName.set(c.name.toUpperCase(), c.id);
  }

  // Apenas nome + CNPJ para novos — demais campos preenchidos manualmente na tela de Clientes
  const insertClient = db.prepare(
    'INSERT INTO clients (name, cnpj, active) VALUES (?, ?, 1)'
  );

  const insertEmail = db.prepare(
    'INSERT OR IGNORE INTO client_emails (client_id, email, is_primary) VALUES (?, ?, ?)'
  );

  db.transaction(() => {
    for (const row of allRows) {
      // Identificação por NOME (case-insensitive) — CNPJ não é usado para deduplicação
      // pois pode haver empresas distintas com o mesmo CNPJ na planilha
      const existingId = existingByName.get(row.name.toUpperCase());

      if (existingId !== undefined) {
        // Já cadastrado — preserva todos os dados; acrescenta apenas e-mails ausentes
        const emailsNovos: string[] = [];
        row.emails.forEach((email, idx) => {
          const r = insertEmail.run(existingId, email, idx === 0 ? 1 : 0);
          if (r.changes > 0) emailsNovos.push(email);
        });

        result.atualizados++;
        result.detalhes.push({
          nome: row.name,
          cnpj: row.cnpj || '—',
          acao: 'atualizado',
          motivo: emailsNovos.length > 0
            ? `e-mail(s) adicionado(s): ${emailsNovos.join(', ')}`
            : 'sem alterações (dados já cadastrados)',
        });
        continue;
      }

      // Novo cliente — importa só nome, CNPJ e e-mails
      const res = insertClient.run(row.name, row.cnpj || null);
      const clientId = res.lastInsertRowid as number;

      row.emails.forEach((email, idx) =>
        insertEmail.run(clientId, email, idx === 0 ? 1 : 0)
      );

      existingByName.set(row.name.toUpperCase(), clientId);

      result.inseridos++;
      result.detalhes.push({
        nome: row.name,
        cnpj: row.cnpj || '—',
        acao: 'inserido',
        motivo: row.emails.length === 0 ? 'sem e-mail cadastrado' : undefined,
      });
    }
  })();

  return result;
}
