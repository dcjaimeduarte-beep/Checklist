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

  const dataHora = new Date().toLocaleString("pt-BR", { timeZone: "America/Maceio" });
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

  cronJob = cron.schedule(expr, () => { void runBackupNow(log); }, { timezone: "America/Maceio" });
  log?.(`[backup] Agendado para ${config.hora} (America/Maceio)`);
}

export function restartScheduler(log?: (msg: string) => void): void {
  startBackupScheduler(log);
}
