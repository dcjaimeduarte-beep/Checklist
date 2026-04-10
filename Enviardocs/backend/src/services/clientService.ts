/**
 * Serviço de negócio para clientes.
 * Chama o repositório e aplica regras de domínio.
 */
import * as repo from '../database/clientRepository';
import type { ClientWithEmails, CreateClientInput, UpdateClientInput } from '../database/clientRepository';

export { ClientWithEmails };

export class ClientNotFoundError extends Error {
  constructor(id: number | string) {
    super(`Cliente não encontrado: ${id}`);
    this.name = 'ClientNotFoundError';
  }
}

export class ClientEmailRequiredError extends Error {
  constructor() {
    super('O cliente não possui e-mail cadastrado. Cadastre ao menos um e-mail antes de enviar documentos.');
    this.name = 'ClientEmailRequiredError';
  }
}

export function listClients(): ClientWithEmails[] {
  return repo.findAllActive();
}

export function getClientById(id: number): ClientWithEmails {
  const client = repo.findById(id);
  if (!client) throw new ClientNotFoundError(id);
  return client;
}

export function searchClients(query: string): ClientWithEmails[] {
  return repo.searchByName(query.trim());
}

export function createClient(input: CreateClientInput): ClientWithEmails {
  return repo.createClient(input);
}

export function updateClient(id: number, input: UpdateClientInput): ClientWithEmails {
  const updated = repo.updateClient(id, input);
  if (!updated) throw new ClientNotFoundError(id);
  return updated;
}

export function deactivateClient(id: number): void {
  const ok = repo.deactivateClient(id);
  if (!ok) throw new ClientNotFoundError(id);
}

/**
 * Resolve o cliente e garante que ele tem e-mails cadastrados.
 * Usado pelo sendDocsController antes de enviar.
 */
export function resolveClientForSend(clientId: number): ClientWithEmails {
  const client = getClientById(clientId);
  if (!client.active) {
    throw new ClientNotFoundError(clientId);
  }
  if (client.emails.length === 0) {
    throw new ClientEmailRequiredError();
  }
  return client;
}

export function getClientHistory(id: number): unknown[] {
  getClientById(id); // lança se não existir
  return repo.getSendHistory(id);
}
