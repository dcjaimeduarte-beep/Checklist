import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
import * as path from "path";
import * as url from "url";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx");

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

type ExcelRow = {
  "Código": number;
  "Razão social": string;
  "Nome fantasia": string;
  "Inscrição estadual": string;
  "CNPJ / CPF": string;
  "Número": string;
  "Complemento": string;
  "Endereço": string;
  "Bairro": string;
  "Cód. bairro": number;
  "Estado": string;
  "Cidade": string;
  "E-mail": string;
  "Cód. cidade": number;
  "Telefone": string;
  "Campo Aux. 1": string;
  "Campo Aux. 2": string;
};

function cleanValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim();
  if (!str || str === "00000000000" || str === "0") return undefined;
  return str;
}

async function main() {
  const filePath = path.resolve(__dirname, "../../../docs/Lista de clientes 2026.xlsx");
  console.log(`Lendo arquivo: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Planilha vazia");

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Sheet não encontrada");

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  console.log(`Total de linhas encontradas: ${rows.length}`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const externalCode = Number(row["Código"]);
    const razaoSocial = cleanValue(row["Razão social"]);

    if (!razaoSocial || razaoSocial === "CONSUMIDOR") {
      skipped++;
      continue;
    }

    const cnpj = cleanValue(row["CNPJ / CPF"]);

    const data = {
      razaoSocial,
      nomeFantasia: cleanValue(row["Nome fantasia"]),
      cnpj,
      inscricaoEstadual: cleanValue(row["Inscrição estadual"]),
      email: cleanValue(row["E-mail"]),
      phone: cleanValue(row["Telefone"]),
      street: cleanValue(row["Endereço"]),
      addressNumber: cleanValue(row["Número"]),
      addressComplement: cleanValue(row["Complemento"]),
      neighborhood: cleanValue(row["Bairro"]),
      city: cleanValue(row["Cidade"]),
      state: cleanValue(row["Estado"])
    };

    try {
      const existing = await prisma.client.findUnique({ where: { externalCode } });

      if (existing) {
        await prisma.client.update({ where: { externalCode }, data });
        updated++;
      } else {
        await prisma.client.create({ data: { ...data, externalCode } });
        created++;
      }
    } catch (err) {
      console.warn(`Erro ao importar código ${externalCode} (${razaoSocial}):`, err);
      skipped++;
    }
  }

  console.log(`\nImportação concluída:`);
  console.log(`  Criados:  ${created}`);
  console.log(`  Atualizados: ${updated}`);
  console.log(`  Ignorados: ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
