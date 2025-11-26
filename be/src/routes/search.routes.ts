import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, getCurrentUser } from '../middleware/auth.middleware.js';
import { logSearchInteraction } from '../services/langfuse.service.js';
import { config } from '../config/index.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/search
 * Search the knowledge base
 */
router.post('/', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { query, limit = 10 } = req.body as { query: string; limit?: number };
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Query is required' });
    return;
  }

  try {
    // Forward request to RAGFlow search API (using aiSearch URL as base)
    const ragflowUrl = new URL(config.ragflow.aiSearch);
    const apiUrl = `${ragflowUrl.origin}/api/v1/search`;
    
    const ragflowResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ragflow.apiKey}`,
      },
      body: JSON.stringify({
        query,
        top_k: limit,
      }),
    });

    if (!ragflowResponse.ok) {
      throw new Error(`RAGFlow API error: ${ragflowResponse.status}`);
    }

    const ragflowData = await ragflowResponse.json() as { results?: SearchResult[] };
    const results = ragflowData.results ?? [];

    // Log to Langfuse
    const traceId = uuidv4();
    const sessionId = uuidv4(); // Search doesn't have persistent sessions
    await logSearchInteraction({
      userId: user.id,
      sessionId,
      traceId,
      query,
      results,
      metadata: {
        userName: user.name,
        userEmail: user.email,
        resultCount: results.length,
      },
    });

    res.json({
      results,
      traceId,
      query,
    });
  } catch (error) {
    console.error('Error processing search:', error);
    res.status(500).json({ error: 'Failed to process search' });
  }
});

export default router;
