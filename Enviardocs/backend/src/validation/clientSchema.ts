import { z } from 'zod';

const emailList = z
  .array(z.string().email('E-mail inválido.'))
  .min(0)
  .default([]);

export const createClientSchema = z.object({
  name: z
    .string({ required_error: 'name é obrigatório.' })
    .min(2, 'name deve ter pelo menos 2 caracteres.')
    .max(200),
  cnpj:            z.string().max(20).optional(),
  contact_name:    z.string().max(100).optional(),
  phone:           z.string().max(50).optional(),
  delivery_method: z.enum(['email', 'boleto', 'pix', 'whatsapp', 'recibo']).default('email'),
  regime:          z.string().max(50).optional(),
  section:         z.enum(['nota_fiscal', 'boleto']).default('nota_fiscal'),
  folder_name:     z.string().max(200).optional(),
  notes:           z.string().max(500).optional(),
  emails:          emailList,
});

export const updateClientSchema = createClientSchema.partial();

export const searchClientSchema = z.object({
  q: z.string().min(2, 'Busca deve ter pelo menos 2 caracteres.').max(100),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
