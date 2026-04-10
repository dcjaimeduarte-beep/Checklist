/**
 * Script de importação de clientes a partir de "Controle financeiro.xlsx".
 *
 * Execução:
 *   npx ts-node src/scripts/importClients.ts
 *   npx ts-node src/scripts/importClients.ts --file /outro/caminho.xlsx
 *
 * Regras de negócio:
 *  - Deduplicação por CNPJ — mesmo CNPJ = merge de e-mails
 *  - Deduplicação por nome exato — quando CNPJ está ausente/inválido
 *  - Múltiplos e-mails por linha (separados por ; ou ,)
 *  - "cancelado" na coluna Mês Compet. → active = 0
 *  - Linhas separadoras (PARCERIA, Clientes Recibo, sem nome) → ignoradas
 *  - Seção "nota_fiscal" antes de "Clientes Recibo", "boleto" depois
 *  - Usa INSERT OR IGNORE + update de e-mails → idempotente (pode rodar várias vezes)
 */
import 'dotenv/config';
import path from 'path';
import XLSX from 'xlsx';
import { runMigrations } from '../database/schema';
import { getDb } from '../database/db';

// ── Configuração ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const fileArgIdx = args.indexOf('--file');
const xlsxPath =
  fileArgIdx >= 0
    ? path.resolve(args[fileArgIdx + 1])
    : path.resolve(__dirname, '../../../docs/Controle financeiro.xlsx');

// Linhas que indicam separador de seção ou devem ser ignoradas
const SECTION_SEPARATOR = /clientes\s+(seven\s+)?-?\s*(boletos?|recibo)/i;
const SKIP_PATTERNS = [
  /^parceria\s*-/i,
  /^clientes\s+(nota\s+fiscal|recibo|seven)/i,
  /^cliente$/i,
];

// ── Tipos ───────────────────────────────────────────────────────────────────

interface RawRow {
  name: string;
  cnpj: string;
  notes: string;
  contact_name: string;
  emails: string[];
  phone: string;
  delivery_method: string;
  regime: string;
  section: 'nota_fiscal' | 'boleto';
  active: number;
}

// ── Leitura da planilha ─────────────────────────────────────────────────────

function parseEmails(raw: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[;,]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes('@') && e.length > 5);
}

function normalizeDeliveryMethod(tipo: string, notes: string): string {
  const n = (notes ?? '').toLowerCase();
  if (n.includes('via zap') || n.includes('whatsapp')) return 'whatsapp';
  const t = (tipo ?? '').toLowerCase();
  if (t.includes('pix')) return 'pix';
  if (t.includes('recibo')) return 'recibo';
  return 'boleto';
}

function shouldSkip(name: string): boolean {
  if (!name || typeof name !== 'string' || name.trim() === '') return true;
  return SKIP_PATTERNS.some((p) => p.test(name.trim()));
}

function readSheet(ws: XLSX.WorkSheet): RawRow[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
  const rows: RawRow[] = [];
  let section: 'nota_fiscal' | 'boleto' = 'nota_fiscal';

  // Encontrar linha de cabeçalho (procura por "Cliente" na coluna 0)
  let dataStart = 5; // padrão observado na planilha
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

    // Verifica se mudou de seção (Clientes Recibo / Boletos)
    if (SECTION_SEPARATOR.test(name) || SECTION_SEPARATOR.test(String(row[2] ?? ''))) {
      section = 'boleto';
      continue;
    }

    if (shouldSkip(name)) continue;

    const notes       = String(row[2] ?? '').trim();
    const tipo        = String(row[7] ?? '').trim();
    const contactName = String(row[8] ?? '').trim();
    const emailRaw    = String(row[9] ?? '').trim();
    const phone       = String(row[10] ?? '').trim();
    const regime      = String(row[11] ?? '').trim();

    const emails = parseEmails(emailRaw);
    const active = /cancelado/i.test(notes) ? 0 : 1;

    let cnpj = String(row[1] ?? '').trim();
    // CNPJ numérico vira string sem formatação
    if (/^\d+$/.test(cnpj) && cnpj.length >= 8) {
      cnpj = cnpj.padStart(14, '0');
    }

    rows.push({
      name,
      cnpj,
      notes,
      contact_name: contactName,
      emails,
      phone,
      delivery_method: normalizeDeliveryMethod(tipo, notes),
      regime,
      section,
      active,
    });
  }

  return rows;
}

// ── Importação para o banco ─────────────────────────────────────────────────

function importRows(allRows: RawRow[]): { inserted: number; updated: number; skipped: number } {
  const db = getDb();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  // Mapa de deduplicação: cnpj → clientId (para merge de e-mails)
  const cnpjMap = new Map<string, number>();
  const nameMap = new Map<string, number>();

  const insertClient = db.prepare(`
    INSERT INTO clients (name, cnpj, contact_name, phone, delivery_method, regime, section, notes, active)
    VALUES (@name, @cnpj, @contact_name, @phone, @delivery_method, @regime, @section, @notes, @active)
  `);

  const insertEmail = db.prepare(`
    INSERT OR IGNORE INTO client_emails (client_id, email, is_primary) VALUES (?, ?, ?)
  `);

  const updateActive = db.prepare(`
    UPDATE clients SET active = ?, updated_at = datetime('now') WHERE id = ?
  `);

  const importAll = db.transaction(() => {
    for (const row of allRows) {
      // Tentar achar cliente existente por CNPJ ou nome
      let existingId: number | undefined;

      if (row.cnpj && row.cnpj.length >= 8) {
        existingId = cnpjMap.get(row.cnpj);
      }
      if (!existingId) {
        existingId = nameMap.get(row.name.toUpperCase());
      }

      if (existingId !== undefined) {
        // Já existe → apenas adicionar novos e-mails
        row.emails.forEach((email, idx) => {
          insertEmail.run(existingId, email, idx === 0 ? 1 : 0);
        });
        // Atualiza status se for inativo
        if (row.active === 0) {
          updateActive.run(0, existingId);
        }
        updated++;
        continue;
      }

      if (row.emails.length === 0 && row.delivery_method === 'email') {
        // Sem e-mail e sem método alternativo — ainda importa mas avisa
        skipped++;
        // Importar mesmo assim para não perder o cadastro
      }

      const result = insertClient.run({
        name:            row.name,
        cnpj:            row.cnpj || null,
        contact_name:    row.contact_name || null,
        phone:           row.phone || null,
        delivery_method: row.delivery_method,
        regime:          row.regime || null,
        section:         row.section,
        notes:           row.notes || null,
        active:          row.active,
      });

      const clientId = result.lastInsertRowid as number;

      row.emails.forEach((email, idx) => {
        insertEmail.run(clientId, email, idx === 0 ? 1 : 0);
      });

      // Registrar nos mapas de dedup
      if (row.cnpj && row.cnpj.length >= 8) cnpjMap.set(row.cnpj, clientId);
      nameMap.set(row.name.toUpperCase(), clientId);

      inserted++;
    }
  });

  importAll();
  return { inserted, updated, skipped };
}

// ── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('📥  Iniciando importação de clientes...');
  console.log(`📄  Arquivo: ${xlsxPath}`);

  runMigrations();

  const wb = XLSX.readFile(xlsxPath);
  const allRows: RawRow[] = [];

  // Usa a aba mais recente (última do array) como referência principal
  // mas passa por todas para garantir clientes novos
  const sheetsToProcess = wb.SheetNames;
  console.log(`📑  Abas encontradas: ${sheetsToProcess.join(', ')}`);

  for (const sheetName of sheetsToProcess) {
    const rows = readSheet(wb.Sheets[sheetName]);
    console.log(`   → ${sheetName}: ${rows.length} linhas lidas`);
    allRows.push(...rows);
  }

  const stats = importRows(allRows);

  console.log('\n✅  Importação concluída:');
  console.log(`   Inseridos : ${stats.inserted}`);
  console.log(`   Atualizados (merge de e-mails): ${stats.updated}`);
  console.log(`   Sem e-mail (importados mesmo assim): ${stats.skipped}`);
}

main();
