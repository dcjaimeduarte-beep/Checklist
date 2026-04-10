/**
 * Configuração de ambiente.
 * Falha imediata se variável obrigatória estiver ausente.
 */
import "dotenv/config";

function required(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  return valor;
}

function optional(nome: string, fallback: string): string {
  return process.env[nome] ?? fallback;
}

export const env = {
  port:       parseInt(optional("PORT", "3000"), 10),
  nodeEnv:    optional("NODE_ENV", "development"),

  apiKey:     required("API_KEY"),

  storageDir: required("STORAGE_DIR"),

  smtpHost:   required("SMTP_HOST"),
  smtpPort:   parseInt(optional("SMTP_PORT", "587"), 10),
  smtpSecure: optional("SMTP_SECURE", "false") === "true",
  smtpUser:   required("SMTP_USER"),
  smtpPass:   required("SMTP_PASS"),
  smtpFrom:   optional("SMTP_FROM", required("SMTP_USER")),

  rateLimit: {
    windowMs: parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000"), 10),
    max:      parseInt(optional("RATE_LIMIT_MAX", "100"), 10),
  },
} as const;
