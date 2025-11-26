import { Router, Request, Response } from 'express';
import { config } from '../config/index.js';
import { log } from '../services/logger.service.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

// Apply auth middleware to all ragflow routes
router.use(requireAuth);

/**
 * GET /api/ragflow/config
 * Returns RAGFlow iframe URLs for frontend
 * Uses direct RAGFlow URLs - no proxy
 */
router.get('/config', (_req: Request, res: Response) => {
  log.debug('RAGFlow config requested');
  res.json({
    aiChatUrl: config.ragflow.aiChatUrl,
    aiSearchUrl: config.ragflow.aiSearchUrl,
  });
});

export default router;
