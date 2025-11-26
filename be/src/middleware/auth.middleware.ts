import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated?.() && req.user) {
    next();
    return;
  }

  // For development: allow mock user
  if (process.env['NODE_ENV'] === 'development') {
    req.user = {
      id: 'dev-user-001',
      email: 'dev@example.com',
      name: 'Development User',
    };
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}

/**
 * Get current user from request
 */
export function getCurrentUser(req: Request): Express.User | undefined {
  return req.user;
}
