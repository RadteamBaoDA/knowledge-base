import * as Minio from 'minio';
import { Readable } from 'stream';
import { log } from './logger.service.js';

interface MinioConfig {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
}

interface FileObject {
    name: string;
    size: number;
    lastModified: Date;
    etag: string;
    isFolder: boolean;
    prefix?: string;
}

class MinioService {
    private client: Minio.Client | null = null;
    private config: MinioConfig;

    constructor() {
        this.config = {
            endPoint: process.env.MINIO_ENDPOINT || 'localhost',
            port: parseInt(process.env.MINIO_PORT || '9000'),
            useSSL: process.env.MINIO_USE_SSL === 'true',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
        };

        this.initialize();
    }

    private initialize(): void {
        try {
            if (!this.config.accessKey || !this.config.secretKey) {
                log.warn('MinIO credentials not configured. Storage features will be disabled.');
                return;
            }

            this.client = new Minio.Client({
                endPoint: this.config.endPoint,
                port: this.config.port,
                useSSL: this.config.useSSL,
                accessKey: this.config.accessKey,
                secretKey: this.config.secretKey,
            });

            log.info('MinIO client initialized', {
                endPoint: this.config.endPoint,
                port: this.config.port,
                useSSL: this.config.useSSL,
            });
        } catch (error) {
            log.error('Failed to initialize MinIO client', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private ensureClient(): Minio.Client {
        if (!this.client) {
            throw new Error('MinIO client not initialized. Check configuration.');
        }
        return this.client;
    }

    // ==================== Bucket Operations ====================

    async listBuckets(): Promise<Minio.BucketItemFromList[]> {
        const client = this.ensureClient();
        try {
            return await client.listBuckets();
        } catch (error) {
            log.error('Failed to list buckets', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async bucketExists(bucketName: string): Promise<boolean> {
        const client = this.ensureClient();
        try {
            return await client.bucketExists(bucketName);
        } catch (error) {
            log.error('Failed to check bucket existence', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    async createBucket(bucketName: string, region?: string): Promise<void> {
        const client = this.ensureClient();
        try {
            const exists = await client.bucketExists(bucketName);
            if (exists) {
                throw new Error(`Bucket '${bucketName}' already exists`);
            }

            await client.makeBucket(bucketName, region || 'us-east-1');
            log.info('Bucket created', { bucketName });
        } catch (error) {
            log.error('Failed to create bucket', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async deleteBucket(bucketName: string): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeBucket(bucketName);
            log.info('Bucket deleted', { bucketName });
        } catch (error) {
            log.error('Failed to delete bucket', {
                bucketName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    // ==================== Object Operations ====================

    async listObjects(
        bucketName: string,
        prefix: string = '',
        recursive: boolean = false
    ): Promise<FileObject[]> {
        const client = this.ensureClient();
        const objects: FileObject[] = [];
        const folders = new Set<string>();

        try {
            const stream = client.listObjects(bucketName, prefix, recursive);

            for await (const obj of stream) {
                if (obj.name) {
                    if (obj.name.endsWith('/')) {
                        const folderName = obj.name.slice(prefix.length);
                        if (folderName && !folders.has(folderName)) {
                            folders.add(folderName);
                            objects.push({
                                name: folderName.replace(/\/$/, ''),
                                size: 0,
                                lastModified: obj.lastModified || new Date(),
                                etag: obj.etag || '',
                                isFolder: true,
                                prefix: obj.name,
                            });
                        }
                    } else {
                        const relativePath = obj.name.slice(prefix.length);

                        if (!recursive) {
                            const parts = relativePath.split('/');
                            if (parts.length > 1) {
                                const folderName = parts[0];
                                const folderPath = prefix + folderName + '/';
                                if (!folders.has(folderPath)) {
                                    folders.add(folderPath);
                                    objects.push({
                                        name: folderName,
                                        size: 0,
                                        lastModified: new Date(),
                                        etag: '',
                                        isFolder: true,
                                        prefix: folderPath,
                                    });
                                }
                                continue;
                            }
                        }

                        objects.push({
                            name: relativePath,
                            size: obj.size || 0,
                            lastModified: obj.lastModified || new Date(),
                            etag: obj.etag || '',
                            isFolder: false,
                        });
                    }
                }
            }

            return objects.sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            log.error('Failed to list objects', {
                bucketName,
                prefix,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async uploadFile(
        bucketName: string,
        objectName: string,
        stream: Buffer | Readable,
        size: number,
        metadata?: Record<string, string>
    ): Promise<{ etag: string; versionId?: string | null }> {
        const client = this.ensureClient();
        try {
            const result = await client.putObject(bucketName, objectName, stream, size, metadata);
            log.info('File uploaded', { bucketName, objectName, size });
            return result;
        } catch (error) {
            log.error('Failed to upload file', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async deleteObject(bucketName: string, objectName: string): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeObject(bucketName, objectName);
            log.info('Object deleted', { bucketName, objectName });
        } catch (error) {
            log.error('Failed to delete object', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async deleteObjects(bucketName: string, objectNames: string[]): Promise<void> {
        const client = this.ensureClient();
        try {
            await client.removeObjects(bucketName, objectNames);
            log.info('Objects deleted', { bucketName, count: objectNames.length });
        } catch (error) {
            log.error('Failed to delete objects', {
                bucketName,
                count: objectNames.length,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async deleteFolder(bucketName: string, folderPrefix: string): Promise<void> {
        const client = this.ensureClient();
        try {
            const prefix = folderPrefix.endsWith('/') ? folderPrefix : folderPrefix + '/';

            const objects: string[] = [];
            const stream = client.listObjects(bucketName, prefix, true);

            for await (const obj of stream) {
                if (obj.name) {
                    objects.push(obj.name);
                }
            }

            if (objects.length > 0) {
                await client.removeObjects(bucketName, objects);
                log.info('Folder deleted', { bucketName, folderPrefix, objectCount: objects.length });
            }
        } catch (error) {
            log.error('Failed to delete folder', {
                bucketName,
                folderPrefix,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async createFolder(bucketName: string, folderPath: string): Promise<void> {
        const client = this.ensureClient();
        try {
            const folderName = folderPath.endsWith('/') ? folderPath : folderPath + '/';
            await client.putObject(bucketName, folderName, Buffer.from(''), 0);
            log.info('Folder created', { bucketName, folderPath: folderName });
        } catch (error) {
            log.error('Failed to create folder', {
                bucketName,
                folderPath,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getDownloadUrl(
        bucketName: string,
        objectName: string,
        expirySeconds: number = 3600
    ): Promise<string> {
        const client = this.ensureClient();
        try {
            const url = await client.presignedGetObject(bucketName, objectName, expirySeconds);
            return url;
        } catch (error) {
            log.error('Failed to generate download URL', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }

    async getObjectStat(bucketName: string, objectName: string): Promise<Minio.BucketItemStat> {
        const client = this.ensureClient();
        try {
            return await client.statObject(bucketName, objectName);
        } catch (error) {
            log.error('Failed to get object stat', {
                bucketName,
                objectName,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
}

export const minioService = new MinioService();
export type { FileObject };
