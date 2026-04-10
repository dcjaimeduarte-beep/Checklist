import { sanitizeClientName, sanitizeYearMonth, SanitizationError } from '../src/security/sanitize';

describe('sanitizeClientName', () => {
  it('aceita nome simples', () => {
    expect(sanitizeClientName('Empresa ABC')).toBe('Empresa ABC');
  });

  it('aceita nome com acento', () => {
    expect(sanitizeClientName('Fábrica Ltda')).toBe('Fábrica Ltda');
  });

  it('normaliza espaços múltiplos', () => {
    expect(sanitizeClientName('Empresa   ABC')).toBe('Empresa ABC');
  });

  it('rejeita sequência ../..', () => {
    expect(() => sanitizeClientName('../../../etc')).toThrow(SanitizationError);
  });

  it('rejeita ponto e vírgula (injeção de shell)', () => {
    expect(() => sanitizeClientName('Empresa; rm -rf /')).toThrow(SanitizationError);
  });

  it('rejeita barra', () => {
    expect(() => sanitizeClientName('Empresa/ABC')).toThrow(SanitizationError);
  });

  it('rejeita string vazia', () => {
    expect(() => sanitizeClientName('')).toThrow(SanitizationError);
  });

  it('rejeita nome maior que 100 chars', () => {
    expect(() => sanitizeClientName('A'.repeat(101))).toThrow(SanitizationError);
  });
});

describe('sanitizeYearMonth', () => {
  it('aceita formato válido', () => {
    expect(sanitizeYearMonth('2024-01')).toBe('2024-01');
    expect(sanitizeYearMonth('2024-12')).toBe('2024-12');
  });

  it('rejeita mês inválido', () => {
    expect(() => sanitizeYearMonth('2024-13')).toThrow(SanitizationError);
    expect(() => sanitizeYearMonth('2024-00')).toThrow(SanitizationError);
  });

  it('rejeita formato errado', () => {
    expect(() => sanitizeYearMonth('01-2024')).toThrow(SanitizationError);
    expect(() => sanitizeYearMonth('../../')).toThrow(SanitizationError);
  });
});
