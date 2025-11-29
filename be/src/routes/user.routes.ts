import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { log } from '../services/logger.service.js';
import { requirePermission } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/users
 * List all users (Requires manage_users permission)
 */
router.get('/', requirePermission('manage_users'), async (req: Request, res: Response) => {
    try {
        const users = await userService.getAllUsers();
        res.json(users);
    } catch (error) {
        log.error('Failed to fetch users', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * PUT /api/users/:id/role
 * Update user role (Requires manage_users permission)
 */
router.put('/:id/role', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!['admin', 'manager', 'user'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
    }

    try {
        const updatedUser = await userService.updateUserRole(id, role);
        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        log.info('User role updated', {
            adminId: req.session.user?.id,
            targetUserId: id,
            newRole: role
        });

        res.json(updatedUser);
    } catch (error) {
        log.error('Failed to update user role', { error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

export default router;
