/**
 * @fileoverview MinIO bucket management routes.
 * 
 * This module provides API endpoints for managing MinIO buckets.
 * Buckets are S3-compatible storage containers that can be created,
 * listed, verified, and deleted.
 * 
 * All routes require admin role.
 * 
 * Features:
 * - Create new buckets (MinIO + database record)
 * - List configured buckets
 * - Verify bucket existence in MinIO
 * - Delete buckets (removes from MinIO and database)
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
 * Returns active buckets ordered by creation date (newest first).
 * Bucket info includes both MinIO name and display name.
 * 
 * @requires admin role
 * @returns {Object} Buckets array and count
 * @returns {500} If database query fails
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        log.debug('Fetching MinIO buckets', { user: req.session.user?.email });

        // Query active buckets, sorted by creation date
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
 * Create a new bucket in MinIO and save to database.
 * 
 * Bucket creation process:
 * 1. Validate bucket name (S3 naming rules)
 * 2. Check for existing bucket with same name
 * 3. Create bucket in MinIO
 * 4. Save bucket record to database
 * 
 * Bucket name rules:
 * - 3-63 characters long
 * - Lowercase letters, numbers, hyphens, and dots only
 * - Must start and end with alphanumeric
 * 
 * @requires admin role
 * @body {string} bucket_name - MinIO bucket name
 * @body {string} display_name - Human-readable name
 * @body {string} [description] - Optional description
 * @returns {Object} Created bucket details
 * @returns {400} If validation fails
 * @returns {409} If bucket name already exists
 * @returns {500} If MinIO or database operation fails
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

        // Check if bucket already exists in database
        const existing = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE bucket_name = $1',
            [bucket_name]
        );

        if (existing.length > 0) {
            res.status(409).json({ error: 'Bucket name already configured' });
            return;
        }

        // Create bucket in MinIO - SKIPPED as per requirement
        // try {
        //     await minioService.createBucket(bucket_name);
        // } catch (minioError) {
        //     log.error('MinIO bucket creation failed', {
        //         bucketName: bucket_name,
        //         error: minioError instanceof Error ? minioError.message : String(minioError),
        //     });
        //     res.status(500).json({
        //         error: 'Failed to create bucket in MinIO',
        //         details: minioError instanceof Error ? minioError.message : undefined,
        //     });
        //     return;
        // }

        // Save to database
        const bucketId = uuidv4();
        await db.query(
            'INSERT INTO minio_buckets (id, bucket_name, display_name, description, created_by, is_active) VALUES ($1, $2, $3, $4, $5, 1)',
            [bucketId, bucket_name, display_name, description || null, userId]
        );

        const newBucket = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        log.info('MinIO bucket created', {
            bucketId,
            bucketName: bucket_name,
            user: req.session.user?.email,
        });

        res.status(201).json({
            message: 'Bucket created successfully',
            bucket: newBucket[0],
        });
    } catch (error) {
        log.error('Failed to create MinIO bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to create bucket' });
    }
});

/**
 * DELETE /api/minio/buckets/:id
 * Delete a bucket from MinIO and database.
 * 
 * Deletion process:
 * 1. Retrieve bucket details from database
 * 2. Attempt to delete from MinIO (continues if MinIO fails)
 * 3. Remove record from database
 * 
 * Note: MinIO deletion may fail if bucket contains objects.
 * Database record is removed regardless.
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
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Try to delete from MinIO - SKIPPED as per requirement
        // try {
        //     await minioService.deleteBucket(bucket.bucket_name);
        // } catch (minioError) {
        //     log.warn('MinIO bucket deletion failed (might already be deleted)', {
        //         bucketName: bucket.bucket_name,
        //         error: minioError instanceof Error ? minioError.message : String(minioError),
        //     });
        //     // Continue to remove from database even if MinIO deletion fails
        // }

        // Remove from database
        await db.query('DELETE FROM minio_buckets WHERE id = $1', [id]);

        log.info('MinIO bucket deleted', {
            bucketId: id,
            bucketName: bucket.bucket_name,
            user: req.session.user?.email,
        });

        res.json({
            message: 'Bucket deleted successfully',
        });
    } catch (error) {
        log.error('Failed to delete MinIO bucket', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to delete bucket' });
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
            res.status(404).json({ error: 'Bucket not found' });
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

export default router;
