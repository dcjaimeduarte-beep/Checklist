/**
 * Testes de integração da API.
 * fileService, emailService, clientService e DB são mockados.
 */
import request from 'supertest';

// Mocks declarados antes do import do app
jest.mock('../src/database/db', () => ({ getDb: jest.fn() }));
jest.mock('../src/database/schema', () => ({ runMigrations: jest.fn() }));

jest.mock('../src/services/fileService', () => ({
  findClientFiles: jest.fn(),
  FileNotFoundError: class FileNotFoundError extends Error {
    constructor(msg: string) { super(msg); this.name = 'FileNotFoundError'; }
  },
}));
jest.mock('../src/services/emailService', () => ({
  sendDocsByEmail: jest.fn(),
  EmailError: class EmailError extends Error {
    constructor(msg: string) { super(msg); this.name = 'EmailError'; }
  },
}));
jest.mock('../src/services/clientService', () => ({
  resolveClientForSend: jest.fn(),
  listClients:          jest.fn().mockReturnValue([]),
  searchClients:        jest.fn().mockReturnValue([]),
  getClientById:        jest.fn(),
  createClient:         jest.fn(),
  updateClient:         jest.fn(),
  deactivateClient:     jest.fn(),
  getClientHistory:     jest.fn().mockReturnValue([]),
  ClientNotFoundError: class ClientNotFoundError extends Error {
    constructor(id: string | number) { super(`Cliente não encontrado: ${id}`); this.name = 'ClientNotFoundError'; }
  },
  ClientEmailRequiredError: class ClientEmailRequiredError extends Error {
    constructor() { super('Sem e-mail'); this.name = 'ClientEmailRequiredError'; }
  },
}));
jest.mock('../src/database/clientRepository', () => ({
  logSend:       jest.fn(),
  getSendHistory: jest.fn().mockReturnValue([]),
  findAllActive:  jest.fn().mockReturnValue([]),
  findById:       jest.fn(),
  searchByName:   jest.fn().mockReturnValue([]),
  createClient:   jest.fn(),
  updateClient:   jest.fn(),
  deactivateClient: jest.fn(),
}));

import app from '../src/app';
import { findClientFiles }    from '../src/services/fileService';
import { sendDocsByEmail }    from '../src/services/emailService';
import { resolveClientForSend } from '../src/services/clientService';

const mockFindClientFiles = findClientFiles    as jest.MockedFunction<typeof findClientFiles>;
const mockSendDocsByEmail = sendDocsByEmail    as jest.MockedFunction<typeof sendDocsByEmail>;
const mockResolveClient   = resolveClientForSend as jest.MockedFunction<typeof resolveClientForSend>;

const VALID_KEY   = 'test-secret-key';
const MOCK_CLIENT = {
  id: 1, name: 'Empresa ABC', cnpj: null, contact_name: null, phone: null,
  delivery_method: 'email', regime: null, section: 'nota_fiscal',
  folder_name: null, notes: null, active: 1,
  created_at: '', updated_at: '',
  emails: ['cliente@empresa.com'],
};

beforeEach(() => jest.clearAllMocks());

// ── POST /api/send-docs ─────────────────────────────────────────────────────
describe('POST /api/send-docs', () => {
  describe('autenticação', () => {
    it('retorna 401 sem API key', async () => {
      const res = await request(app).post('/api/send-docs').send({ clientId: 1, month: '2024-01' });
      expect(res.status).toBe(401);
    });

    it('retorna 403 com API key errada', async () => {
      const res = await request(app)
        .post('/api/send-docs').set('x-api-key', 'errada')
        .send({ clientId: 1, month: '2024-01' });
      expect(res.status).toBe(403);
    });
  });

  describe('validação de body', () => {
    it('retorna 400 sem clientId', async () => {
      const res = await request(app)
        .post('/api/send-docs').set('x-api-key', VALID_KEY)
        .send({ month: '2024-01' });
      expect(res.status).toBe(400);
    });

    it('retorna 400 com month no formato errado', async () => {
      const res = await request(app)
        .post('/api/send-docs').set('x-api-key', VALID_KEY)
        .send({ clientId: 1, month: '01/2024' });
      expect(res.status).toBe(400);
    });

    it('retorna 400 com mês 13', async () => {
      const res = await request(app)
        .post('/api/send-docs').set('x-api-key', VALID_KEY)
        .send({ clientId: 1, month: '2024-13' });
      expect(res.status).toBe(400);
    });
  });

  describe('fluxo de sucesso', () => {
    it('retorna 200 e recipients vem do banco (não do request)', async () => {
      mockResolveClient.mockReturnValue(MOCK_CLIENT);
      mockFindClientFiles.mockReturnValue({
        files: ['/tmp/docs/2024-01/Empresa ABC_001.pdf'],
        searchedIn: '/tmp/docs/2024-01',
      });
      mockSendDocsByEmail.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/send-docs').set('x-api-key', VALID_KEY)
        .send({ clientId: 1, month: '2024-01' });

      expect(res.status).toBe(200);
      expect(res.body.fileCount).toBe(1);
      expect(res.body.recipients).toEqual(['cliente@empresa.com']);
      expect(res.body.client.id).toBe(1);
    });
  });
});

// ── GET /api/clients ────────────────────────────────────────────────────────
describe('GET /api/clients', () => {
  it('retorna 401 sem API key', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(401);
  });

  it('retorna 200 com lista', async () => {
    const res = await request(app).get('/api/clients').set('x-api-key', VALID_KEY);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── Health check ────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('retorna 200 sem autenticação', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
