import { z } from "zod";

export const createTemplateSchema = z.object({
  name:      z.string().min(1, "Nome é obrigatório"),
  content:   z.string().min(1, "Conteúdo é obrigatório"),
  isDefault: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const templateIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
