import { z } from "zod";

const listaEmails = z.array(z.string().email("E-mail inválido.")).default([]);

export const criarClienteSchema = z.object({
  nome:           z.string().min(2).max(200),
  cnpj:           z.string().max(20).optional(),
  nomeContato:    z.string().max(100).optional(),
  telefone:       z.string().max(50).optional(),
  tipoEnvio:      z.enum(["email", "boleto", "pix", "whatsapp", "recibo"]).default("email"),
  regime:         z.string().max(50).optional(),
  secao:          z.enum(["nota_fiscal", "boleto"]).default("nota_fiscal"),
  nomePasta:      z.string().max(200).optional(),
  observacoes:    z.string().max(500).optional(),
  emails:         listaEmails,
});

export const atualizarClienteSchema = criarClienteSchema.partial();

export type CriarClienteInput = z.infer<typeof criarClienteSchema>;
