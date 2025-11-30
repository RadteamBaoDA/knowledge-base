/**
 * @fileoverview Authentication and authorization middleware.
 * 
 * This module provides Express middleware for:
 * - Session-based authentication (requireAuth)
 * - Permission-based authorization (requirePermission)
 * - Role-based access control (requireRole)
 * - Optional authentication checking (checkSession)
 * 
 * Authentication is handled via express-session with user data
 * stored after successful Azure AD OAuth login.
 * 
 * @module middleware/auth
 * @example
 * import { requireAuth, requirePermission } from './middleware/auth.middleware.js';
 * 
 * // Require authentication
 * router.get('/protected', requireAuth, handler);
 * 
 * // Require specific permission
 * router.post('/admin', requireAuth, requirePermission('manage_users'), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger.service.js';
import { AzureAdUser } from '../services/auth.service.js';
import { Permission, Role, hasPermission } from '../config/rbac.js';

// ============================================================================
// TYPE EXTENSIONS
// ============================================================================

/**
 * Extend Express Session to include application-specific data.
 * This adds type safety for session properties used in authentication.
 */
declare module 'express-session' {
  interface SessionData {
    /** Authenticated user data from Azure AD */
    user?: AzureAdUser & {
      role?: string;
      permissions?: string[];
    };
    /** OAuth state parameter for CSRF protection */
    oauthState?: string | undefined;
    /** Azure AD access token for Graph API calls */
    accessToken?: string | undefined;
  }
}

/**
 * Extend Express Request and global namespace for user data.
 * Allows accessing user via req.user with proper typing.
 */
declare global {
  namespace Express {
    /** User interface with Azure AD and RBAC properties */
    interface User extends AzureAdUser {
      role?: string;
      permissions?: string[];
    }

    interface Request {
      /** Authenticated user attached by auth middleware */
      user?: User;
    }
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to require authentication.
 * Returns 401 Unauthorized if no valid session exists.
 * 
 * Use this middleware on routes that require a logged-in user.
 * Attaches user data to req.user for downstream handlers.
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Next middleware function
 * 
 * @example
 * router.get('/profile', requireAuth, (req, res) => {
 *   res.json({ user: req.user });
 * });
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Check for valid session with user data
  if (req.session?.user) {
    // Attach user to request for easy access in route handlers
    req.user = req.session.user;
    log.debug('User authenticated via session', { userId: req.user.id, email: req.user.email });
    next();
    return;
  }

  // No valid session - return 401 Unauthorized
  // Note: Auto dev user was removed to fix logout issues
  // Use POST /api/auth/dev-login endpoint for development testing
  log.debug('Unauthorized request - no session', {
    path: req.path,
    sessionId: req.sessionID?.substring(0, 8)
  });
  res.status(401).json({ error: 'Unauthorized', message: 'Session not found or expired' });
}

/**
 * Middleware for optional authentication checking.
 * Attaches user to request if session exists, but doesn't block.
 * 
 * Use this for routes that work both with and without authentication,
 * such as public pages that show personalized content for logged-in users.
 * 
 * @param req - Express request object
 * @param _res - Express response object (unused)
 * @param next - Next middleware function
 * 
 * @example
 * router.get('/home', checkSession, (req, res) => {
 *   if (req.user) {
 *     // Show personalized content
 *   } else {
 *     // Show public content
 *   }
 * });
 */
export function checkSession(req: Request, _res: Response, next: NextFunction): void {
  if (req.session?.user) {
    req.user = req.session.user;
  }
  next();
}

/**
 * Get current authenticated user from request.
 * Utility function for retrieving user data in route handlers.
 * 
 * @param req - Express request object
 * @returns User object if authenticated, undefined otherwise
 * 
 * @example
 * router.get('/data', requireAuth, (req, res) => {
 *   const user = getCurrentUser(req);
 *   // user is guaranteed to exist after requireAuth
 * });
 */
export function getCurrentUser(req: Request): Express.User | undefined {
  // Check session first (primary source)
  if (req.session?.user) {
    return req.session.user;
  }

  // Fall back to req.user (set by middleware)
  return req.user;
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Middleware factory for permission-based authorization.
 * Returns 403 Forbidden if user lacks the required permission.
 * 
 * Must be used after requireAuth middleware to ensure user exists.
 * Checks both role-based permissions and explicit user permissions.
 * 
 * @param permission - The permission required to access the route
 * @returns Express middleware function
 * 
 * @example
 * // Require manage_users permission
 * router.get('/users', requireAuth, requirePermission('manage_users'), handler);
 * 
 * // Require storage:write permission
 * router.post('/upload', requireAuth, requirePermission('storage:write'), handler);
 */
export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Check authentication first
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check role-based permission (from RBAC config)
    if (user.role && hasPermission(user.role, permission)) {
      next();
      return;
    }

    // Check explicit permissions array (for custom per-user permissions)
    if (user.permissions && user.permissions.includes(permission)) {
      next();
      return;
    }

    // Permission denied - log and return 403
    log.warn('Access denied: missing permission', {
      userId: user.id,
      role: user.role,
      requiredPermission: permission
    });
    res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  };
}

/**
 * Middleware factory for role-based authorization.
 * Returns 403 Forbidden if user doesn't have the exact role.
 * 
 * Use this when a specific role is required, not just permissions.
 * For permission-based checks, prefer requirePermission().
 * 
 * @param role - The exact role required to access the route
 * @returns Express middleware function
 * 
 * @example
 * // Only admins can access this route
 * router.get('/admin-only', requireAuth, requireRole('admin'), handler);
 */
export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;

    // Check authentication first
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check exact role match
    if (user.role === role) {
      next();
      return;
    }

    // Role mismatch - log and return 403
    log.warn('Access denied: incorrect role', {
      userId: user.id,
      userRole: user.role,
      requiredRole: role
    });
    res.status(403).json({ error: 'Forbidden: Insufficient role' });
  };
}
