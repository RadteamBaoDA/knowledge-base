/**
 * @fileoverview User management routes.
 * 
 * This module provides API endpoints for managing users in the system.
 * All routes require 'manage_users' permission (admin/manager roles).
 * 
 * Features:
 * - List all users
 * - Update user roles
 * 
 * @module routes/user
 */

import { Router, Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import { log } from '../services/logger.service.js';
import { requirePermission } from '../middleware/auth.middleware.js';

const router = Router();

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/users
 * List all users in the system.
 * 
 * Returns user records from the database with role information.
 * Sensitive fields like access tokens are not included.
 * 
 * @requires manage_users permission
 * @returns {Array<User>} List of all users
 * @returns {500} If database query fails
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
 * Update a user's role.
 * 
 * Changes the role of the specified user. Valid roles are:
 * - 'admin': Full system access
 * - 'manager': Can manage users and storage
 * - 'user': Basic access only
 * 
 * @requires manage_users permission
 * @param {string} id - User ID (UUID)
 * @body {string} role - New role ('admin' | 'manager' | 'user')
 * @returns {User} Updated user object
 * @returns {400} If role is invalid
 * @returns {404} If user not found
 * @returns {500} If update fails
 */
router.put('/:id/role', requirePermission('manage_users'), async (req: Request, res: Response) => {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role value
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
