/**
 * Serviço de comunicação com a API do backend.
 *
 * NUNCA armazene a API Key no código ou no localStorage.
 * Em produção, o backend deve ser chamado por um BFF (Backend for Frontend)
 * que mantém a chave no servidor, nunca exposta ao navegador.
 */
import type { SendDocsPayload, SendDocsResponse, ApiError } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.error);
    this.name = 'ApiRequestError';
  }
}

export async function sendDocs(payload: SendDocsPayload): Promise<SendDocsResponse> {
  const res = await fetch(`${BASE_URL}/api/send-docs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // A chave deve vir de um BFF ou ser omitida se o frontend for interno
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body: ApiError = await res.json();
    throw new ApiRequestError(res.status, body);
  }

  return res.json() as Promise<SendDocsResponse>;
}
