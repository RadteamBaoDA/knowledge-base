import { Router, Request, Response } from 'express';
import { systemToolsService } from '../services/system-tools.service.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// Require admin role for all system tools routes
router.use(requireRole('admin'));

/**
 * GET /api/system-tools
 * Get all enabled system monitoring tools
 */
router.get('/', (req: Request, res: Response) => {
    try {
        log.debug('Fetching system tools', { user: req.session.user?.email });

        const tools = systemToolsService.getEnabledTools();

        res.json({
            tools,
            count: tools.length,
        });
    } catch (error) {
        log.error('Failed to fetch system tools', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch system tools' });
    }
});

/**
 * POST /api/system-tools/reload
 * Reload system tools configuration (admin only)
 */
router.post('/reload', (req: Request, res: Response) => {
    try {
        log.info('Reloading system tools configuration', {
            user: req.session.user?.email,
        });

        systemToolsService.reload();
        const tools = systemToolsService.getEnabledTools();

        res.json({
            message: 'System tools configuration reloaded',
            count: tools.length,
        });
    } catch (error) {
        log.error('Failed to reload system tools', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to reload system tools' });
    }
});

export default router;
