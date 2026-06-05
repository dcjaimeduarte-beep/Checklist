import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Senha é obrigatória")
});

export type LoginBody = z.infer<typeof loginBodySchema>;
