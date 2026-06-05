import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().min(1, "Informe seu e-mail ou nome de usuário"),
  password: z.string().min(1, "Senha é obrigatória")
});

export type LoginBody = z.infer<typeof loginBodySchema>;
