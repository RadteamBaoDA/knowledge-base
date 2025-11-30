/**
 * @fileoverview Administrative routes for system management.
 * 
 * This module provides API endpoints for administrative operations
 * that require special API key authentication (not regular user auth).
 * 
 * Security:
 * - All routes require X-Admin-API-Key header
 * - API key must match ADMIN_API_KEY environment variable
 * - These routes are for DevOps/admin scripts, not regular users
 * 
 * @module routes/admin
 */

import { Router, Request, Response, NextFunction } from 'express';
import { log } from '../services/logger.service.js';

const router = Router();

// ============================================================================
// Admin Authentication Middleware
// ============================================================================

/**
 * Middleware to validate admin API key.
 * 
 * Checks X-Admin-API-Key header against ADMIN_API_KEY env variable.
 * Returns 401 if invalid, 500 if not configured.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware function
 */
const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-admin-api-key'];
    const configuredKey = process.env.ADMIN_API_KEY;

    // Ensure admin API key is configured
    if (!configuredKey) {
        log.error('Admin API key not configured');
        res.status(500).json({ error: 'Admin API not configured' });
        return;
    }

    // Validate provided key
    if (apiKey !== configuredKey) {
        log.warn('Invalid admin API key attempt', { ip: req.ip });
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    next();
};

/** Apply admin authentication to all routes */
router.use(requireAdminKey);

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * POST /api/admin/logout-all
 * Force logout all users by clearing the session store.
 * 
 * Use cases:
 * - Security incident response
 * - Force re-authentication after permission changes
 * - System maintenance
 * 
 * @returns {Object} Success message
 * @returns {500} If session store doesn't support clear operation
 */
router.post('/logout-all', (req: Request, res: Response) => {
    log.warn('Admin initiated global logout (clearing session store)');

    // Verify session store supports clear operation
    if (!req.sessionStore || !req.sessionStore.clear) {
        log.error('Session store does not support clear operation');
        res.status(500).json({ error: 'Session store does not support this operation' });
        return;
    }

    // Clear all sessions
    req.sessionStore.clear((err) => {
        if (err) {
            log.error('Failed to clear session store', { error: err.message });
            res.status(500).json({ error: 'Failed to clear sessions' });
            return;
        }

        log.info('All sessions cleared successfully');
        res.json({ message: 'All users have been logged out' });
    });
});

export default router;
