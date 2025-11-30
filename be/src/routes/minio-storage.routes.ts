import { Router, Request, Response } from 'express';
import multer from 'multer';
import { minioService } from '../services/minio.service.js';
import { db } from '../db/index.js';
import { log } from '../services/logger.service.js';
import { requirePermission } from '../middleware/auth.middleware.js';
import { MinioBucket } from '../models/minio-bucket.model.js';

const router = Router();

// Configure multer for memory storage (files stored in memory, not disk)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
});

// Manager and admin can perform storage operations
router.use(requirePermission('storage:write'));

/**
 * GET /api/minio/storage/:bucketId/list
 * List files and folders in a bucket
 */
router.get('/:bucketId/list', async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const { prefix = '' } = req.query;

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1 AND is_active = 1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // List objects
        const objects = await minioService.listObjects(
            bucket.bucket_name,
            prefix as string,
            false
        );

        res.json({
            bucket: {
                id: bucket.id,
                name: bucket.bucket_name,
                display_name: bucket.display_name,
            },
            prefix: prefix || '',
            objects,
            count: objects.length,
        });
    } catch (error) {
        log.error('Failed to list objects', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to list objects' });
    }
});

/**
 * POST /api/minio/storage/:bucketId/upload
 * Upload files to a bucket
 */
router.post('/:bucketId/upload', upload.any(), async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const { prefix = '', preserveFolderStructure, filePaths } = req.body;
        const files = (req.files as Express.Multer.File[]) || [];

        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No files uploaded' });
            return;
        }

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Parse filePaths if it exists (could be a string or array)
        let filePathsArray: string[] = [];
        if (preserveFolderStructure === 'true' && filePaths) {
            filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
        }

        // Upload files
        const uploadResults = await Promise.allSettled(
            files.map(async (file, index) => {
                let objectName: string;

                if (preserveFolderStructure === 'true' && filePathsArray[index]) {
                    // Use the relative path from the folder structure
                    objectName = prefix ? `${prefix}${filePathsArray[index]}` : filePathsArray[index];
                } else {
                    // Use just the filename
                    objectName = prefix ? `${prefix}${file.originalname}` : file.originalname;
                }

                return minioService.uploadFile(
                    bucket.bucket_name,
                    objectName,
                    file.buffer,
                    file.size,
                    {
                        'Content-Type': file.mimetype,
                    }
                );
            })
        );

        const successful = uploadResults.filter((r) => r.status === 'fulfilled').length;
        const failed = uploadResults.filter((r) => r.status === 'rejected').length;

        log.info('Files uploaded', {
            bucketId,
            successful,
            failed,
            preserveFolderStructure: preserveFolderStructure === 'true',
            user: req.session.user?.email,
        });

        res.json({
            message: `Uploaded ${successful} file(s) successfully`,
            successful,
            failed,
            details: uploadResults,
        });
    } catch (error) {
        log.error('Failed to upload files', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

/**
 * POST /api/minio/storage/:bucketId/folder
 * Create a folder in a bucket
 */
router.post('/:bucketId/folder', async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const { folder_name, prefix = '' } = req.body;

        if (!folder_name) {
            res.status(400).json({ error: 'folder_name is required' });
            return;
        }

        // Validate folder name (no special chars, no slashes)
        const folderNameRegex = /^[a-zA-Z0-9_\- ]+$/;
        if (!folderNameRegex.test(folder_name)) {
            res.status(400).json({
                error: 'Invalid folder name. Only alphanumeric, spaces, hyphens, and underscores allowed.',
            });
            return;
        }

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Create folder path
        const folderPath = prefix ? `${prefix}${folder_name}` : folder_name;

        await minioService.createFolder(bucket.bucket_name, folderPath);

        log.info('Folder created', {
            bucketId,
            folderPath,
            user: req.session.user?.email,
        });

        res.json({
            message: 'Folder created successfully',
            folder: folderPath,
        });
    } catch (error) {
        log.error('Failed to create folder', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

/**
 * DELETE /api/minio/storage/:bucketId/delete
 * Delete a file or folder
 */
router.delete('/:bucketId/delete', async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const { object_name, is_folder } = req.body;

        if (!object_name) {
            res.status(400).json({ error: 'object_name is required' });
            return;
        }

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        if (is_folder) {
            await minioService.deleteFolder(bucket.bucket_name, object_name);
        } else {
            await minioService.deleteObject(bucket.bucket_name, object_name);
        }

        log.info('Object deleted', {
            bucketId,
            objectName: object_name,
            isFolder: is_folder,
            user: req.session.user?.email,
        });

        res.json({
            message: 'Object deleted successfully',
        });
    } catch (error) {
        log.error('Failed to delete object', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to delete object' });
    }
});

/**
 * POST /api/minio/storage/:bucketId/batch-delete
 * Delete multiple files or folders
 */
router.post('/:bucketId/batch-delete', async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const { objects } = req.body as { objects: Array<{ name: string; isFolder: boolean }> };

        if (!objects || !Array.isArray(objects) || objects.length === 0) {
            res.status(400).json({ error: 'objects array is required' });
            return;
        }

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Separate files and folders
        const files = objects.filter((obj) => !obj.isFolder).map((obj) => obj.name);
        const folders = objects.filter((obj) => obj.isFolder).map((obj) => obj.name);

        // Delete files in batch
        if (files.length > 0) {
            await minioService.deleteObjects(bucket.bucket_name, files);
        }

        // Delete folders one by one (recursive delete)
        if (folders.length > 0) {
            await Promise.all(
                folders.map((folder) => minioService.deleteFolder(bucket.bucket_name, folder))
            );
        }

        log.info('Batch delete completed', {
            bucketId,
            filesDeleted: files.length,
            foldersDeleted: folders.length,
            user: req.session.user?.email,
        });

        res.json({
            message: `Deleted ${files.length} file(s) and ${folders.length} folder(s)`,
            files_deleted: files.length,
            folders_deleted: folders.length,
        });
    } catch (error) {
        log.error('Failed to batch delete', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to batch delete' });
    }
});

/**
 * GET /api/minio/storage/:bucketId/download/:path(*)
 * Get presigned download URL for a file
 */
router.get('/:bucketId/download/*', async (req: Request, res: Response) => {
    try {
        const { bucketId } = req.params;
        const objectPath = req.params[0]; // Everything after /download/

        if (!objectPath) {
            res.status(400).json({ error: 'Object path is required' });
            return;
        }

        // Get bucket details
        const buckets = await db.query<MinioBucket>(
            'SELECT * FROM minio_buckets WHERE id = $1',
            [bucketId]
        );

        if (buckets.length === 0) {
            res.status(404).json({ error: 'Bucket not found' });
            return;
        }

        const bucket = buckets[0]!;

        // Generate presigned URL (valid for 1 hour)
        const downloadUrl = await minioService.getDownloadUrl(bucket.bucket_name, objectPath, 3600);

        res.json({
            download_url: downloadUrl,
            expires_in: 3600,
        });
    } catch (error) {
        log.error('Failed to generate download URL', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});

export default router;
