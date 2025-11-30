const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// ==================== Types ====================

export interface MinioBucket {
    id: string;
    bucket_name: string;
    display_name: string;
    description?: string;
    created_by: string;
    created_at: string;
    is_active: boolean;
}

export interface FileObject {
    name: string;
    size: number;
    lastModified: Date;
    etag: string;
    isFolder: boolean;
    prefix?: string;
}

export interface CreateBucketDto {
    bucket_name: string;
    display_name: string;
    description?: string;
}

// ==================== Bucket Operations ====================

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

// ==================== Storage Operations ====================

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

export const uploadFiles = async (
    bucketId: string,
    files: File[],
    prefix: string = '',
    onProgress?: (progress: number) => void,
    preserveFolderStructure: boolean = false
): Promise<any> => {
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

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
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
