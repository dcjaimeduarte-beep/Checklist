/** Payload enviado ao endpoint POST /api/send-docs */
export interface SendDocsPayload {
  clientName: string;
  clientEmail: string;
  month: string; // YYYY-MM
}

/** Resposta de sucesso */
export interface SendDocsResponse {
  message: string;
  recipient: string;
  month: string;
  fileCount: number;
}

/** Resposta de erro */
export interface ApiError {
  error: string;
  details?: Array<{ field: string; message: string }>;
}
