/**
 * @fileoverview MinIO storage service for bucket and file operations.
 * 
 * Provides API functions for interacting with MinIO object storage:
 * - Bucket management (list, create, delete)
 * - File operations (list, upload, download, delete)
 * - Folder management
 * 
 * All operations require authentication and appropriate permissions.
 * 
 * @module services/minioService
 */

/** Backend API base URL */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ============================================================================
// Types
// ============================================================================

/**
 * MinIO bucket record from the database.
 */
export interface MinioBucket {
    /** Unique bucket ID (UUID) */
    id: string;
    /** MinIO bucket name (S3-compatible) */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Optional description */
    description?: string;
    /** User ID who created the bucket */
    created_by: string;
    /** Creation timestamp (ISO string) */
    created_at: string;
    /** Whether bucket is active */
    is_active: boolean;
}

/**
 * File or folder object in MinIO.
 */
export interface FileObject {
    /** Object name (file name or folder name) */
    name: string;
    /** File size in bytes */
    size: number;
    /** Last modified date */
    lastModified: Date;
    /** Object ETag (hash) */
    etag: string;
    /** Whether this is a folder */
    isFolder: boolean;
    /** Full path prefix */
    prefix?: string;
}

/**
 * Data for creating a new bucket.
 */
export interface CreateBucketDto {
    /** MinIO bucket name (must follow S3 naming rules) */
    bucket_name: string;
    /** Human-readable display name */
    display_name: string;
    /** Optional description */
    description?: string;
}

// ============================================================================
// Bucket Operations
// ============================================================================

/**
 * Fetch all configured buckets.
 * @returns Array of bucket records
 * @throws Error if fetch fails
 */
export const getBuckets = async (): Promise<MinioBucket[]> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets`, {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch buckets: ${response.statusText}`);
    }

    const data = await response.json();
    return data.buckets;
};

/**
 * Create a new bucket.
 * @param bucket - Bucket creation data
 * @returns Created bucket record
 * @throws Error if creation fails
 */
export const createBucket = async (bucket: CreateBucketDto): Promise<MinioBucket> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(bucket),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create bucket');
    }

    const data = await response.json();
    return data.bucket;
};

/**
 * Delete a bucket by ID.
 * @param bucketId - Bucket UUID to delete
 * @throws Error if deletion fails
 */
export const deleteBucket = async (bucketId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/buckets/${bucketId}`, {
        method: 'DELETE',
        credentials: 'include',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete bucket');
    }
};

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * List objects in a bucket at the given prefix.
 * @param bucketId - Bucket UUID
 * @param prefix - Path prefix (folder path)
 * @returns Array of file/folder objects
 * @throws Error if listing fails
 */
export const listObjects = async (
    bucketId: string,
    prefix: string = ''
): Promise<FileObject[]> => {
    const url = new URL(`${API_BASE_URL}/api/minio/storage/${bucketId}/list`);
    if (prefix) {
        url.searchParams.set('prefix', prefix);
    }

    const response = await fetch(url.toString(), {
        credentials: 'include',
    });

    if (!response.ok) {
        throw new Error(`Failed to list objects: ${response.statusText}`);
    }

    const data = await response.json();
    return data.objects;
};

/**
 * Upload files to a bucket.
 * Uses XMLHttpRequest for progress tracking.
 * 
 * @param bucketId - Bucket UUID
 * @param files - Array of File objects to upload
 * @param prefix - Optional path prefix
 * @param onProgress - Optional callback for upload progress (0-100)
 * @returns Upload result from server
 * @throws Error if upload fails
 */
export const uploadFiles = async (
    bucketId: string,
    files: File[],
    prefix: string = '',
    onProgress?: (progress: number) => void,
    preserveFolderStructure: boolean = false
): Promise<any> => {
    // Build FormData with files
    const formData = new FormData();

    files.forEach((file) => {
        formData.append('files', file);
        // If preserving folder structure, send the relative path
        if (preserveFolderStructure && (file as any).webkitRelativePath) {
            formData.append('filePaths', (file as any).webkitRelativePath);
        }
    });

    if (prefix) {
        formData.append('prefix', prefix);
    }

    if (preserveFolderStructure) {
        formData.append('preserveFolderStructure', 'true');
    }

    if (preserveFolderStructure) {
        formData.append('preserveFolderStructure', 'true');
    }

    // Use XHR for progress tracking (fetch doesn't support upload progress)
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(`Upload failed: ${xhr.statusText}`));
            }
        });

        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });

        xhr.open('POST', `${API_BASE_URL}/api/minio/storage/${bucketId}/upload`);
        xhr.withCredentials = true;
        xhr.send(formData);
    });
};

/**
 * Create a folder in a bucket.
 * @param bucketId - Bucket UUID
 * @param folderName - Folder name to create
 * @param prefix - Parent folder prefix
 * @throws Error if creation fails
 */
export const createFolder = async (
    bucketId: string,
    folderName: string,
    prefix: string = ''
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/folder`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            folder_name: folderName,
            prefix,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create folder');
    }
};

/**
 * Delete a single file or folder.
 * @param bucketId - Bucket UUID
 * @param objectName - Full object path
 * @param isFolder - Whether the object is a folder
 * @throws Error if deletion fails
 */
export const deleteObject = async (
    bucketId: string,
    objectName: string,
    isFolder: boolean
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            object_name: objectName,
            is_folder: isFolder,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete object');
    }
};

/**
 * Delete multiple files and/or folders.
 * @param bucketId - Bucket UUID
 * @param objects - Array of objects to delete with name and isFolder flag
 * @throws Error if deletion fails
 */
export const batchDelete = async (
    bucketId: string,
    objects: Array<{ name: string; isFolder: boolean }>
): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/api/minio/storage/${bucketId}/batch-delete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ objects }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to batch delete');
    }
};

/**
 * Get a presigned download URL for a file.
 * URL is valid for 1 hour.
 * 
 * @param bucketId - Bucket UUID
 * @param objectPath - Full object path
 * @returns Presigned download URL
 * @throws Error if URL generation fails
 */
export const getDownloadUrl = async (bucketId: string, objectPath: string): Promise<string> => {
    const response = await fetch(
        `${API_BASE_URL}/api/minio/storage/${bucketId}/download/${objectPath}`,
        {
            credentials: 'include',
        }
    );

    if (!response.ok) {
        throw new Error('Failed to get download URL');
    }

    const data = await response.json();
    return data.download_url;
};
