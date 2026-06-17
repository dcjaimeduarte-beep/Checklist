import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().min(1, "Informe seu e-mail ou nome de usuário"),
  password: z.string().min(1, "Senha é obrigatória")
});

export const registerBodySchema = z.object({
  name:     z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email:    z.email("E-mail inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export const forgotPasswordBodySchema = z.object({
  email: z.email("E-mail inválido"),
});

export const resetPasswordBodySchema = z.object({
  token:    z.string().min(1),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
export type RegisterBody = z.infer<typeof registerBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
