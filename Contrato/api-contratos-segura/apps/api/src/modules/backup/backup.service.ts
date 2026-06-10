import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import cron from "node-cron";
import { prisma } from "../../lib/prisma.js";

const CONFIG_PATH = path.resolve(process.cwd(), "data", "backup-config.json");

export interface BackupConfig {
  ativo: boolean;
  hora: string;         // ex: "02:00"
  enviar_email: boolean;
  email_destino: string;
  manter_dias: number;
  ultimo_backup: string | null;
  ultimo_status: string | null;
}

const DEFAULT_CONFIG: BackupConfig = {
  ativo: false,
  hora: "02:00",
  enviar_email: false,
  email_destino: "",
  manter_dias: 30,
  ultimo_backup: null,
  ultimo_status: null,
};

export function getBackupConfig(): BackupConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveBackupConfig(config: BackupConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export async function exportAllData(): Promise<string> {
  const [users, clients, contracts, templates, contractTypes, revendas] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    prisma.client.findMany(),
    prisma.contract.findMany({ include: { client: { select: { razaoSocial: true, cnpj: true } } } }),
    prisma.contractTemplate.findMany(),
    prisma.contractTypeConfig.findMany(),
    prisma.revenda.findMany(),
  ]);

  const data = {
    exportado_em: new Date().toISOString(),
    sistema: "Gestão de Contratos — Seven Sistemas de Automação",
    tabelas: { users, clients, contracts, templates, contractTypes, revendas },
    totais: {
      usuarios: users.length,
      clientes: clients.length,
      contratos: contracts.length,
      templates: templates.length,
    },
  };

  return JSON.stringify(data, null, 2);
}

export async function sendBackupEmail(jsonData: string, config: BackupConfig): Promise<void> {
  const host = process.env["BACKUP_EMAIL_HOST"];
  const port = parseInt(process.env["BACKUP_EMAIL_PORT"] ?? "587");
  const user = process.env["BACKUP_EMAIL_USER"];
  const pass = process.env["BACKUP_EMAIL_PASS"];
  const from = process.env["BACKUP_EMAIL_FROM"] ?? `Contratos Seven <${user}>`;

  if (!host || !user || !pass) throw new Error("Variáveis BACKUP_EMAIL_* não configuradas no .env");

  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });

  const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const nomeArquivo = `backup-contratos-${new Date().toISOString().slice(0, 10)}.json`;

  await transporter.sendMail({
    from,
    to: config.email_destino,
    subject: `Backup do Sistema de Contratos — ${dataHora}`,
    text: `Backup automático gerado em ${dataHora}.\n\nO arquivo JSON está em anexo.`,
    attachments: [{ filename: nomeArquivo, content: jsonData, contentType: "application/json" }],
  });
}

export async function runBackupNow(log?: (msg: string) => void): Promise<{ ok: boolean; message: string }> {
  const config = getBackupConfig();
  const agora = new Date().toISOString();

  try {
    log?.("[backup] Exportando dados...");
    const jsonData = await exportAllData();

    if (config.enviar_email && config.email_destino) {
      log?.(`[backup] Enviando e-mail para ${config.email_destino}...`);
      await sendBackupEmail(jsonData, config);
    }

    saveBackupConfig({ ...config, ultimo_backup: agora, ultimo_status: "ok" });
    log?.("[backup] Concluído com sucesso.");
    return { ok: true, message: `Backup realizado em ${new Date(agora).toLocaleString("pt-BR")}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    saveBackupConfig({ ...config, ultimo_backup: agora, ultimo_status: `erro: ${msg}` });
    log?.(`[backup] Erro: ${msg}`);
    return { ok: false, message: msg };
  }
}

type BackupData = {
  tabelas: {
    revendas?: Record<string, unknown>[];
    clients?: Record<string, unknown>[];
    contracts?: Record<string, unknown>[];
    templates?: Record<string, unknown>[];
    contractTypes?: Record<string, unknown>[];
  };
};

export async function restoreFromBackup(jsonString: string): Promise<{ ok: boolean; message: string; totais: Record<string, number> }> {
  let parsed: BackupData;
  try {
    parsed = JSON.parse(jsonString) as BackupData;
  } catch {
    return { ok: false, message: "JSON inválido.", totais: {} };
  }

  const { tabelas } = parsed;
  if (!tabelas) return { ok: false, message: "Arquivo de backup inválido — campo 'tabelas' não encontrado.", totais: {} };

  // Remove campos undefined para compatibilidade com exactOptionalPropertyTypes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function strip(obj: Record<string, unknown>): any {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  }

  const totais: Record<string, number> = {};

  // Ordem: revendas → clients → contracts → templates → contractTypes
  if (tabelas.revendas?.length) {
    for (const r of tabelas.revendas) {
      await prisma.revenda.upsert({
        where: { id: r["id"] as string },
        create: strip({ id: r["id"], name: r["name"], contactName: r["contactName"], email: r["email"], phone: r["phone"], createdAt: new Date(r["createdAt"] as string) }),
        update: strip({ name: r["name"], contactName: r["contactName"], email: r["email"], phone: r["phone"] }),
      });
    }
    totais["revendas"] = tabelas.revendas.length;
  }

  if (tabelas.clients?.length) {
    for (const c of tabelas.clients) {
      await prisma.client.upsert({
        where: { id: c["id"] as string },
        create: strip({ id: c["id"], externalCode: c["externalCode"], razaoSocial: c["razaoSocial"], nomeFantasia: c["nomeFantasia"], cnpj: c["cnpj"], inscricaoEstadual: c["inscricaoEstadual"], email: c["email"], phone: c["phone"], contactName: c["contactName"], street: c["street"], addressNumber: c["addressNumber"], addressComplement: c["addressComplement"], neighborhood: c["neighborhood"], city: c["city"], state: c["state"], zipCode: c["zipCode"], revendaId: c["revendaId"], createdAt: new Date(c["createdAt"] as string) }),
        update: strip({ razaoSocial: c["razaoSocial"], nomeFantasia: c["nomeFantasia"], email: c["email"], phone: c["phone"], contactName: c["contactName"] }),
      });
    }
    totais["clientes"] = tabelas.clients.length;
  }

  if (tabelas.contracts?.length) {
    for (const ct of tabelas.contracts) {
      const { client: _c, ...f } = ct as Record<string, unknown> & { client?: unknown };
      void _c;
      const clientExists = await prisma.client.findUnique({ where: { id: f["clientId"] as string }, select: { id: true } });
      if (!clientExists) continue;
      await prisma.contract.upsert({
        where: { id: f["id"] as string },
        create: strip({ id: f["id"], clientId: f["clientId"], identifier: f["identifier"], status: f["status"], contractType: f["contractType"], startDate: new Date(f["startDate"] as string), endDate: f["endDate"] ? new Date(f["endDate"] as string) : undefined, durationMonths: f["durationMonths"], implementationFee: f["implementationFee"], implementationPayment: f["implementationPayment"], monthlyFee: f["monthlyFee"], discount: f["discount"], paymentDayOfMonth: f["paymentDayOfMonth"], adjustmentIndex: f["adjustmentIndex"], moduleCadastros: f["moduleCadastros"], moduleFaturamento: f["moduleFaturamento"], moduleFiscal: f["moduleFiscal"], notes: f["notes"], contactName: f["contactName"], contactPhone: f["contactPhone"], implementationNote: f["implementationNote"], createdAt: new Date(f["createdAt"] as string) }),
        update: strip({ status: f["status"], monthlyFee: f["monthlyFee"], notes: f["notes"] }),
      });
    }
    totais["contratos"] = tabelas.contracts.length;
  }

  if (tabelas.templates?.length) {
    for (const t of tabelas.templates) {
      await prisma.contractTemplate.upsert({
        where: { id: t["id"] as string },
        create: strip({ id: t["id"], name: t["name"], content: t["content"], isDefault: t["isDefault"], createdAt: new Date(t["createdAt"] as string) }),
        update: strip({ name: t["name"], content: t["content"] }),
      });
    }
    totais["templates"] = tabelas.templates.length;
  }

  if (tabelas.contractTypes?.length) {
    for (const ct of tabelas.contractTypes) {
      await prisma.contractTypeConfig.upsert({
        where: { id: ct["id"] as string },
        create: strip({ id: ct["id"], type: ct["type"], displayName: ct["displayName"], clauseOverrides: ct["clauseOverrides"], createdAt: new Date(ct["createdAt"] as string) }),
        update: strip({ displayName: ct["displayName"], clauseOverrides: ct["clauseOverrides"] }),
      });
    }
    totais["tiposContrato"] = tabelas.contractTypes.length;
  }

  const resumo = Object.entries(totais).map(([k, v]) => `${v} ${k}`).join(", ");
  return { ok: true, message: `Restauração concluída: ${resumo}.`, totais };
}

let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startBackupScheduler(log?: (msg: string) => void): void {
  if (cronJob) { cronJob.stop(); cronJob = null; }

  const config = getBackupConfig();
  if (!config.ativo) {
    log?.("[backup] Agendamento desativado.");
    return;
  }

  const [hora, minuto] = config.hora.split(":").map(Number);
  const expr = `${minuto ?? 0} ${hora ?? 2} * * *`;

  cronJob = cron.schedule(expr, () => { void runBackupNow(log); }, { timezone: "America/Sao_Paulo" });
  log?.(`[backup] Agendado para ${config.hora} (America/Sao_Paulo)`);
}

export function restartScheduler(log?: (msg: string) => void): void {
  startBackupScheduler(log);
}
