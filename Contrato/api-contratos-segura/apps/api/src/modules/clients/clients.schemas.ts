import { z } from "zod";

export const createClientSchema = z.object({
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().optional(),
  inscricaoEstadual: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional(),
  phone: z.string().optional(),
  street: z.string().optional(),
  addressNumber: z.string().optional(),
  addressComplement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  revendaId: z.string().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export const clientIdParamSchema = z.object({
  id: z.string().min(1)
});

export const listClientsQuerySchema = z.object({
  search:    z.string().optional(),
  status:    z.enum(["active", "inactive"]).optional(),
  revendaId: z.string().optional(),
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().positive().max(5000).default(20),
  sortBy:    z.enum(["razaoSocial", "externalCode", "cnpj", "createdAt"]).default("razaoSocial"),
  sortDir:   z.enum(["asc", "desc"]).default("asc"),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
