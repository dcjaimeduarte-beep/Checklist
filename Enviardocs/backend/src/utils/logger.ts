export function logInfo(message: string, data?: unknown): void {
  console.log(`[INFO] ${new Date().toISOString()} ${message}`, data ?? "");
}

export function logWarn(message: string, data?: unknown): void {
  console.warn(`[WARN] ${new Date().toISOString()} ${message}`, data ?? "");
}

export function logError(message: string, data?: unknown): void {
  console.error(`[ERROR] ${new Date().toISOString()} ${message}`, data ?? "");
}
