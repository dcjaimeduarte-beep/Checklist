import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_HOST: z.string().default("0.0.0.0"),
  APP_PORT: z.coerce.number().int().positive().default(3333),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW: z.string().default("1 minute"),

  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET deve ter pelo menos 16 caracteres"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),

  SEED_ADMIN_NAME: z.string().min(2),
  SEED_ADMIN_EMAIL: z.email(),
  SEED_ADMIN_PASSWORD: z.string().min(8),
  SEED_ADMIN_ROLE: z.enum(["admin", "juridico", "comercial", "operador"]).default("admin"),

  // Firebird — sistema financeiro
  FB_HOST:     z.string().optional(),
  FB_PORT:     z.string().optional(),
  FB_DATABASE: z.string().optional(),
  FB_USER:     z.string().optional(),
  FB_PASSWORD: z.string().optional(),

  // Sync periódico de clientes do Firebird (0 = desativado)
  FB_CLIENT_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(60),

  // Enviardocs API
  ENVIARDOCS_URL:     z.string().optional(),
  ENVIARDOCS_API_KEY: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Erro ao validar variáveis de ambiente:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
