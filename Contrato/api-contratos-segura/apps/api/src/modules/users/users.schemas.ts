import { z } from "zod";

export const createUserBodySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.email(),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  role: z.enum(["admin", "juridico", "comercial", "operador", "revenda"]),
  revendaId: z.string().optional(),
});

export const updateUserStatusParamsSchema = z.object({
  id: z.string().min(1, "ID é obrigatório")
});

export const updateUserStatusBodySchema = z.object({
  status: z.enum(["active", "inactive"])
});

export const getUserByIdParamsSchema = z.object({
  id: z.string().min(1, "ID é obrigatório")
});

export type CreateUserBody = z.infer<typeof createUserBodySchema>;
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;
export type UpdateUserStatusParams = z.infer<typeof updateUserStatusParamsSchema>;
export type GetUserByIdParams = z.infer<typeof getUserByIdParamsSchema>;
