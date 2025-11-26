import { Router, Request, Response } from 'express';
import { getCurrentUser } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  res.json({ user });
});

/**
 * GET /api/auth/login
 * Initiate Azure AD login
 * In production, this would redirect to Azure AD
 */
router.get('/login', (_req: Request, res: Response) => {
  // TODO: Implement Azure AD OAuth flow with passport-azure-ad
  // For now, return a placeholder response
  res.json({ 
    message: 'Azure AD login not yet implemented',
    loginUrl: '/auth/azure' 
  });
});

/**
 * GET /api/auth/logout
 * Logout the current user
 */
router.get('/logout', (req: Request, res: Response) => {
  req.logout?.((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
  });
  
  // Clear session
  req.session?.destroy?.((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
  });

  res.json({ message: 'Logged out successfully' });
});

export default router;
