import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger.service.js';
import { AzureAdUser } from '../services/auth.service.js';
import { Permission, Role, hasPermission } from '../config/rbac.js';

// Extend Express Session to include user data
declare module 'express-session' {
  interface SessionData {
    user?: AzureAdUser & {
      role?: string;
      permissions?: string[];
    };
    oauthState?: string | undefined;
    accessToken?: string | undefined;
  }
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface User extends AzureAdUser {
      role?: string;
      permissions?: string[];
    }

    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 * Returns 401 if not authenticated (for API routes)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check session-based authentication
  if (req.session?.user) {
    req.user = req.session.user;
    log.debug('User authenticated via session', { userId: req.user.id, email: req.user.email });
    next();
    return;
  }

  // No session found - return 401
  // NOTE: Auto dev user has been removed to fix logout issues
  // Use POST /api/auth/dev-login endpoint for development
  log.debug('Unauthorized request - no session', {
    path: req.path,
    sessionId: req.sessionID?.substring(0, 8)
  });
  res.status(401).json({ error: 'Unauthorized', message: 'Session not found or expired' });
}

/**
 * Middleware to check session (soft check - doesn't block, just sets user)
 * Use this for routes that work with or without auth
 */
export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Get current user from request
 */
export function getCurrentUser(req: Request): Express.User | undefined {
  // Check session first
  if (req.session?.user) {
    return req.session.user;
  }

  // Fall back to req.user (for dev mode)
  return req.user;
}

/**
 * Middleware to check for specific permission
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (user.role && hasPermission(user.role, permission)) {
      next();
      return;
    }

    // Check explicit permissions array if we decide to support custom permissions per user
    if (user.permissions && user.permissions.includes(permission)) {
      next();
      return;
    }

    log.warn('Access denied: missing permission', {
      userId: user.id,
      role: user.role,
      requiredPermission: permission
    });
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  };
}

/**
 * Middleware to check for specific role
 */
export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (user.role === role) {
      next();
      return;
    }

    log.warn('Access denied: incorrect role', {
      userId: user.id,
      userRole: user.role,
      requiredRole: role
    });
    res.status(403).json({ error: 'Forbidden: Insufficient role' });
  };
}
