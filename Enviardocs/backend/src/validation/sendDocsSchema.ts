/**
 * Schema de validação para POST /api/send-docs.
 *
 * MUDANÇA: clientEmail foi REMOVIDO do request.
 * O e-mail agora vem exclusivamente do banco de dados (clientId → emails cadastrados).
 * Isso elimina o risco de redirecionamento de documentos para e-mails indevidos.
 */
import { z } from 'zod';

export const sendDocsSchema = z.object({
  clientId: z
    .number({ required_error: 'clientId é obrigatório.' })
    .int('clientId deve ser um número inteiro.')
    .positive('clientId deve ser positivo.'),

  month: z
    .string({ required_error: 'month é obrigatório.' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month deve estar no formato YYYY-MM.'),
});

export type SendDocsInput = z.infer<typeof sendDocsSchema>;
