import { z } from "zod";

export const createContractSchema = z.object({
  clientId: z.string().min(1),
  identifier: z.string().optional(),
  startDate: z.string().datetime(),
  durationMonths: z.number().int().positive().default(12),
  implementationFee: z.number().min(0).default(0),
  implementationPayment: z.string().default("avista"),
  monthlyFee: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  paymentDayOfMonth: z.number().int().min(1).max(31).default(10),
  firstPaymentDate: z.string().datetime().optional(),
  adjustmentIndex: z.string().default("IGPM"),
  adjustmentRate: z.number().min(0).max(100).optional(),
  moduleCadastros: z.boolean().default(false),
  moduleFaturamento: z.boolean().default(false),
  moduleFiscal: z.boolean().default(false),
  distanceFromProviderKm: z.number().int().min(0).optional(),
  notes: z.string().optional(),
  contractType: z.enum(["SOLUTIO_ERP", "GCONCILIADOR", "SOLUTIO_WEB"]).default("SOLUTIO_ERP"),
});

export const updateContractSchema = createContractSchema.partial().omit({ clientId: true });

export const signContractSchema = z.object({
  signedAt: z.string().datetime().optional()
});

export const updateContractStatusSchema = z.object({
  status: z.enum(["draft", "active", "terminated", "cancelled", "expired"])
});

export const contractIdParamSchema = z.object({
  id: z.string().min(1)
});

export const listContractsQuerySchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(["draft", "active", "terminated", "cancelled", "expired"]).optional(),
  isSigned: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
