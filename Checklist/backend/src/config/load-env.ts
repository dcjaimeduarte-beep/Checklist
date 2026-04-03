import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config } from 'dotenv';

/**
 * Carrega `.env` e, se existir, `env.sites` (override) — alinhado a `backend/env.sites.example`.
 * Deve ser chamado antes de `NestFactory.create`.
 */
export function loadEnv(): void {
  const root = process.cwd();
  config({ path: resolve(root, '.env') });
  const sitesPath = resolve(root, 'env.sites');
  if (existsSync(sitesPath)) {
    config({ path: sitesPath, override: true });
  }
}
