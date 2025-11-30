/**
 * @fileoverview MinIO bucket management routes for Knowledge Base Documents.
 * 
 * This module provides API endpoints for managing MinIO bucket metadata.
 * Bucket configurations are stored in database - actual MinIO buckets are not
 * created or deleted. This allows admins to configure which existing MinIO
 * buckets are accessible through the application.
 * 
 * All routes require admin role.
 * 
 * Features:
 * - Add bucket configuration to database (link existing MinIO bucket)
 * - List configured buckets from database
 * - Verify bucket existence in MinIO
 * - Remove bucket configuration from database
 * 
 * @module routes/minio-bucket
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { minioService } from '../services/minio.service.js';
import { db } from '../db/index.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { MinioBucket, CreateMinioBucketDto } from '../models/minio-bucket.model.js';

const router = Router();

// ============================================================================
// Middleware
// ============================================================================

/** All bucket management routes require admin role */
router.use(requireRole('admin'));

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/minio/buckets
 * List all configured buckets from database.
 * 
 * Returns active bucket configurations with display names.
 * 
 * @requires admin role
 * @returns {Object} Buckets array and count
 * @returns {500} If database query fails
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        log.debug('Fetching configured MinIO buckets', { user: req.session.user?.email });

        // Query active buckets from database
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE is_active = 1 ORDER BY created_at DESC'
        );

        res.json({
            buckets,
            count: buckets.length,
        });
    } catch (error) {
        log.error('Failed to fetch MinIO buckets', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to fetch buckets' });
    }
});

/**
 * POST /api/minio/buckets
 * Add a bucket configuration to database.
 * 
 * This does NOT create the bucket in MinIO - it only adds metadata
 * to link an existing MinIO bucket to the application.
 * 
 * Bucket configuration process:
 * 1. Validate bucket name (S3 naming rules)
 * 2. Check if bucket exists in MinIO (must exist)
 * 3. Check if bucket is already configured in database
 * 4. Save bucket configuration to database
 * 
 * @requires admin role
 * @body {string} bucket_name - MinIO bucket name (must exist in MinIO)
 * @body {string} display_name - Human-readable display name
 * @body {string} [description] - Optional description
 * @returns {Object} Created bucket configuration
 * @returns {400} If validation fails or bucket doesn't exist in MinIO
 * @returns {409} If bucket is already configured
 * @returns {500} If database operation fails
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { bucket_name, display_name, description } = req.body as CreateMinioBucketDto;
        const userId = req.session.user?.id;

        if (!userId) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        // Validate input
        if (!bucket_name || !display_name) {
            res.status(400).json({ error: 'bucket_name and display_name are required' });
            return;
        }

        // Validate bucket name (MinIO naming rules: lowercase, alphanumeric, hyphens, dots)
        const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
        if (!bucketNameRegex.test(bucket_name)) {
            res.status(400).json({
                error: 'Invalid bucket name. Must be 3-63 characters, lowercase, alphanumeric, hyphens, and dots only.',
            });
            return;
        }

        // Check if bucket exists in MinIO (it must exist)
        const existsInMinio = await minioService.bucketExists(bucket_name);
        if (!existsInMinio) {
            res.status(400).json({ error: 'Bucket does not exist in MinIO. Please create it in MinIO first.' });
            return;
        }

        // Check if bucket is already configured in database
        const existing = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE bucket_name = $1',
            [bucket_name]
        );

        if (existing.length > 0) {
            res.status(409).json({ error: 'Bucket is already configured' });
            return;
        }

        // Save bucket configuration to database
        const bucketId = uuidv4();
        await db.query(
            'INSERT INTO minio_buckets (id, bucket_name, display_name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
            [bucketId, bucket_name, display_name, description || null, userId]
        );

        const newBucket = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        log.info('MinIO bucket configured', {
            bucketId,
            bucketName: bucket_name,
            user: req.session.user?.email,
        });

        res.status(201).json({
            message: 'Bucket configured successfully',
            bucket: newBucket[0],
        });
    } catch (error) {
        log.error('Failed to configure MinIO bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to configure bucket' });
    }
});

/**
 * DELETE /api/minio/buckets/:id
 * Remove a bucket configuration from database.
 * 
 * This does NOT delete the bucket from MinIO - it only removes
 * the metadata configuration from the database.
 * 
 * @requires admin role
 * @param {string} id - Bucket ID (UUID)
 * @returns {Object} Success message
 * @returns {404} If bucket not found
 * @returns {500} If database operation fails
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Get bucket details from database
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [id]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket configuration not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Remove from database (soft delete or hard delete)
        await db.query('DELETE FROM minio_buckets WHERE id = $1', [id]);

        log.info('MinIO bucket configuration removed', {
            bucketId: id,
            bucketName: bucket.bucket_name,
            user: req.session.user?.email,
        });

        res.json({
            message: 'Bucket configuration removed successfully',
        });
    } catch (error) {
        log.error('Failed to remove MinIO bucket configuration', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to remove bucket configuration' });
    }
});

/**
 * GET /api/minio/buckets/:id/verify
 * Verify if bucket exists in MinIO.
 * 
 * Checks if the configured bucket actually exists in MinIO.
 * Useful for debugging sync issues between database and MinIO.
 * 
 * @requires admin role
 * @param {string} id - Bucket ID (UUID)
 * @returns {Object} Bucket name and existence status
 * @returns {404} If bucket not found in database
 * @returns {500} If MinIO check fails
 */
router.get('/:id/verify', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [id]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket configuration not found' });
            return;
        }

        const bucket = buckets[0]!;
        const exists = await minioService.bucketExists(bucket.bucket_name);

        res.json({
            bucket_name: bucket.bucket_name,
            exists,
        });
    } catch (error) {
        log.error('Failed to verify bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to verify bucket' });
    }
});

/**
 * GET /api/minio/buckets/available
 * List all buckets from MinIO that are not yet configured.
 * 
 * Returns buckets that exist in MinIO but are not in the database.
 * Helps admins discover which buckets can be added.
 * 
 * @requires admin role
 * @returns {Object} Available buckets array
 * @returns {500} If MinIO query fails
 */
router.get('/available/list', async (req: Request, res: Response) => {
    try {
        // Get all buckets from MinIO
        const minioBuckets = await minioService.listBuckets();

        // Get all configured bucket names from database
        const configuredBuckets = await db.query<MinioBucket>(
            'SELECT bucket_name FROM minio_buckets WHERE is_active = 1'
        );
        const configuredNames = new Set(configuredBuckets.map(b => b.bucket_name));

        // Filter to only unconfigured buckets
        const availableBuckets = minioBuckets
            .filter(b => !configuredNames.has(b.name))
            .map(b => ({
                name: b.name,
                creationDate: b.creationDate,
            }));

        res.json({
            buckets: availableBuckets,
            count: availableBuckets.length,
        });
    } catch (error) {
        log.error('Failed to list available buckets', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to list available buckets' });
    }
});

export default router;
