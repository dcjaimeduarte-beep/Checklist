import { z } from "zod";

export const envioSchema = z.object({
  clienteId: z
    .number({ required_error: "clienteId é obrigatório." })
    .int()
    .positive(),

  mes: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "mes deve estar no formato YYYY-MM.")
    .optional(),
});

export type EnvioInput = z.infer<typeof envioSchema>;
