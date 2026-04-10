import { Request, Response, NextFunction } from "express";
import { criarClienteSchema, atualizarClienteSchema } from "../validations/cliente.validation";
import * as clienteService from "../services/cliente.service";

export function listarClientes(_req: Request, res: Response, next: NextFunction): void {
  try {
    const clientes = clienteService.listarClientes();
    res.json({ dados: clientes, total: clientes.length });
  } catch (err) { next(err); }
}

export function buscarCliente(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ erro: "ID inválido." }); return; }
    res.json(clienteService.buscarClientePorId(id));
  } catch (err) { next(err); }
}

export function buscarPorNome(req: Request, res: Response, next: NextFunction): void {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) { res.status(400).json({ erro: "Busca precisa de ao menos 2 caracteres." }); return; }
    const clientes = clienteService.buscarPorNome(q);
    res.json({ dados: clientes, total: clientes.length });
  } catch (err) { next(err); }
}

export function criarCliente(req: Request, res: Response, next: NextFunction): void {
  try {
    const input = criarClienteSchema.parse(req.body);
    const cliente = clienteService.criarCliente({
      nome:        input.nome,
      cnpj:        input.cnpj,
      nomeContato: input.nomeContato,
      telefone:    input.telefone,
      tipoEnvio:   input.tipoEnvio,
      regime:      input.regime,
      secao:       input.secao,
      nomePasta:   input.nomePasta,
      observacoes: input.observacoes,
      emails:      input.emails,
    });
    res.status(201).json(cliente);
  } catch (err) { next(err); }
}

export function atualizarCliente(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ erro: "ID inválido." }); return; }
    const input = atualizarClienteSchema.parse(req.body);
    res.json(clienteService.atualizarCliente(id, {
      nome:        input.nome,
      cnpj:        input.cnpj,
      nomeContato: input.nomeContato,
      telefone:    input.telefone,
      tipoEnvio:   input.tipoEnvio,
      regime:      input.regime,
      secao:       input.secao,
      nomePasta:   input.nomePasta,
      observacoes: input.observacoes,
      emails:      input.emails,
    }));
  } catch (err) { next(err); }
}

export function desativarCliente(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ erro: "ID inválido." }); return; }
    clienteService.desativarCliente(id);
    res.status(204).send();
  } catch (err) { next(err); }
}

export function historicoEnvios(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ erro: "ID inválido." }); return; }
    res.json({ dados: clienteService.historicoEnvios(id) });
  } catch (err) { next(err); }
}
