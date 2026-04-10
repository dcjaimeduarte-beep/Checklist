/**
 * Executado pelo Jest antes de carregar qualquer módulo.
 * Garante que variáveis de ambiente obrigatórias existam nos testes.
 */
process.env.API_SECRET_KEY = 'test-secret-key';
process.env.DOCS_BASE_PATH = '/tmp/docs';
process.env.SMTP_HOST = 'smtp.test.com';
process.env.SMTP_USER = 'test@test.com';
process.env.SMTP_PASS = 'pass';
process.env.NODE_ENV = 'test';
