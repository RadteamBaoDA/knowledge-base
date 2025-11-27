import { Router, Request, Response, NextFunction } from 'express';
import { log } from '../services/logger.service.js';

const router = Router();

// Middleware to check admin API key
const requireAdminKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-admin-api-key'];
    const configuredKey = process.env.ADMIN_API_KEY;

    if (!configuredKey) {
        log.error('Admin API key not configured');
        res.status(500).json({ error: 'Admin API not configured' });
        return;
    }

    if (apiKey !== configuredKey) {
        log.warn('Invalid admin API key attempt', { ip: req.ip });
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    next();
};

// Apply admin auth to all routes
router.use(requireAdminKey);

/**
 * POST /api/admin/logout-all
 * Force logout all users by clearing the session store
 */
router.post('/logout-all', (req: Request, res: Response) => {
    log.warn('Admin initiated global logout (clearing session store)');

    if (!req.sessionStore || !req.sessionStore.clear) {
        log.error('Session store does not support clear operation');
        res.status(500).json({ error: 'Session store does not support this operation' });
        return;
    }

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
