import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, getCurrentUser } from '../middleware/auth.middleware.js';
import { logChatInteraction } from '../services/langfuse.service.js';
import {
  createSession,
  getSession,
  getUserSessions,
  addMessage,
  deleteSession,
} from '../services/history.service.js';
import { config } from '../config/index.js';

const router = Router();

// Apply auth middleware to all routes
router.use(requireAuth);

/**
 * GET /api/chat/sessions
 * Get all chat sessions for the current user
 */
router.get('/sessions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const sessions = getUserSessions(user.id);
  res.json({ sessions });
});

/**
 * POST /api/chat/sessions
 * Create a new chat session
 */
router.post('/sessions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { title } = req.body as { title?: string };
  const session = createSession(user.id, title);
  res.status(201).json({ session });
});

/**
 * GET /api/chat/sessions/:sessionId
 * Get a specific chat session
 */
router.get('/sessions/:sessionId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const session = getSession(req.params['sessionId'] ?? '');
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.userId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  res.json({ session });
});

/**
 * DELETE /api/chat/sessions/:sessionId
 * Delete a chat session
 */
router.delete('/sessions/:sessionId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const session = getSession(req.params['sessionId'] ?? '');
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.userId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  deleteSession(session.id);
  res.status(204).send();
});

/**
 * POST /api/chat/sessions/:sessionId/messages
 * Send a message and get AI response
 */
router.post('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const sessionId = req.params['sessionId'] ?? '';
  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  if (session.userId !== user.id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { message } = req.body as { message: string };
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  // Add user message to history
  const userMessage = addMessage(sessionId, 'user', message);

  try {
    // Forward request to RAGFlow (using aiChat URL as base)
    const ragflowUrl = new URL(config.ragflow.aiChat);
    const apiUrl = `${ragflowUrl.origin}/api/v1/chat`;
    
    const ragflowResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ragflow.apiKey}`,
      },
      body: JSON.stringify({
        message,
        session_id: sessionId,
      }),
    });

    if (!ragflowResponse.ok) {
      throw new Error(`RAGFlow API error: ${ragflowResponse.status}`);
    }

    const ragflowData = await ragflowResponse.json() as { response?: string };
    const aiResponse = ragflowData.response ?? 'No response from AI';

    // Add AI response to history
    const assistantMessage = addMessage(sessionId, 'assistant', aiResponse);

    // Log to Langfuse
    const traceId = uuidv4();
    await logChatInteraction({
      userId: user.id,
      sessionId,
      traceId,
      userPrompt: message,
      aiResponse,
      metadata: {
        userName: user.name,
        userEmail: user.email,
      },
    });

    res.json({
      userMessage,
      assistantMessage,
      traceId,
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
