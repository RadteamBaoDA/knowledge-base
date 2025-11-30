import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { minioService } from '../services/minio.service.js';
import { db } from '../db/index.js';
import { log } from '../services/logger.service.js';
import { requireRole } from '../middleware/auth.middleware.js';
import { MinioBucket, CreateMinioBucketDto } from '../models/minio-bucket.model.js';

const router = Router();

// All bucket management routes require admin role
router.use(requireRole('admin'));

/**
 * GET /api/minio/buckets
 * List all configured buckets from database
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        log.debug('Fetching MinIO buckets', { user: req.session.user?.email });

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
 * Create a new bucket in MinIO and save to database
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
 * Delete a bucket from MinIO and database
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
 * Verify if bucket exists in MinIO
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
