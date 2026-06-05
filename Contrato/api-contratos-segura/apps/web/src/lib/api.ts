function getApiBaseUrl(): string {
  // No browser: proxy same-origin evita "Failed to fetch" ao abrir pelo IP da rede
  if (typeof window !== "undefined") {
    return "/api-backend";
  }
  return process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3333";
}

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match?.[1] ?? null;
}

export function setToken(token: string) {
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`;
}

export function clearToken() {
  document.cookie = "token=; path=/; max-age=0";
}

type FetchOptions = RequestInit & { auth?: boolean };

export type ApiError = Error & { suggestions?: { path: string; name: string }[] };

export function isApiError(e: unknown): e is ApiError {
  return e instanceof Error && "suggestions" in e;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { auth = true, ...rest } = options;
  const headers: HeadersInit = {
    ...(rest.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(rest.headers ?? {}),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, { ...rest, headers });
  } catch {
    throw new Error(
      "Não foi possível contactar a API. Confirme que o servidor está a correr (porta 3333) e recarregue a página.",
    );
  }

  // Token expirado ou inválido → limpa cookie e manda para login
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erro desconhecido" })) as {
      message?: string;
      suggestions?: { path: string; name: string }[];
    };
    const err = new Error(error.message ?? `HTTP ${res.status}`) as ApiError;
    if (error.suggestions?.length) err.suggestions = error.suggestions;
    throw err;
  }

  // 204 No Content ou body vazio — não tenta parsear JSON
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}
