/**
 * Rotas de documentos.
 *
 * Todas as rotas deste router já passam pelo middleware de autenticação
 * e rate limiting definidos no app.ts.
 */
import { Router } from 'express';
import { sendDocsController } from '../controllers/sendDocsController';

const router = Router();

// POST /api/send-docs
// Body: { clientName, clientEmail, month }
router.post('/send-docs', sendDocsController);

export default router;
