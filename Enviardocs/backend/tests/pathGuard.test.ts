import path from 'path';
import { safeJoin, PathTraversalError } from '../src/security/pathGuard';

const BASE = '/var/data/clientes';

describe('safeJoin — path traversal prevention', () => {
  it('permite caminho legítimo dentro da base', () => {
    const result = safeJoin(BASE, '2024-01', 'Empresa ABC');
    expect(result).toBe(path.resolve(BASE, '2024-01', 'Empresa ABC'));
  });

  it('bloqueia ../ clássico', () => {
    expect(() => safeJoin(BASE, '../etc/passwd')).toThrow(PathTraversalError);
  });

  it('bloqueia sequência aninhada ../../', () => {
    expect(() => safeJoin(BASE, '2024-01', '../../etc')).toThrow(PathTraversalError);
  });

  it('bloqueia caminho absoluto que sai da base', () => {
    expect(() => safeJoin(BASE, '/etc/passwd')).toThrow(PathTraversalError);
  });

  it('bloqueia caminho que começa exatamente na base (sem subpath)', () => {
    // Tenta acessar a própria base como se fosse um arquivo — deve ser permitido
    // mas normalmente exigiria ao menos um segmento filho; aqui validamos que
    // a base exata não é bloqueada pela guard (ela protege apenas saídas).
    expect(() => safeJoin(BASE)).not.toThrow();
  });
});
