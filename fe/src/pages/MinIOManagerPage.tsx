/**
 * @fileoverview MinIO storage manager page.
 * 
 * File manager interface for MinIO object storage:
 * - Browse buckets and files
 * - Upload files with progress indicator
 * - Download files
 * - Delete files and folders (single and batch)
 * - Navigate folder hierarchy
 * 
 * Available to admins and managers.
 * 
 * @module pages/MinIOManagerPage
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HardDrive, Trash2, Upload, Download, AlertCircle, RefreshCw, FolderPlus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Select } from '../components/Select';
import {
    MinioBucket,
    FileObject,
    getBuckets,
    deleteBucket,
    listObjects,
    uploadFiles,
    deleteObject,
    batchDelete,
    getDownloadUrl
} from '../services/minioService';

// ============================================================================
// Component
// ============================================================================

/**
 * MinIO storage manager page component.
 * 
 * Features:
 * - Bucket selection dropdown (rendered in header via portal)
 * - File/folder listing with navigation
 * - Multi-select with checkbox
 * - Upload with progress indicator
 * - Download and delete actions
 * - Responsive table layout
 * 
 * Admin-only features:
 * - Delete bucket
 */
const MinIOManagerPage = () => {
    const { user } = useAuth();
    
    // Bucket and object state
    const [buckets, setBuckets] = useState<MinioBucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [objects, setObjects] = useState<FileObject[]>([]);
    const [currentPrefix, setCurrentPrefix] = useState('');
    
    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    
    // Loading and error state
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadBuckets();
    }, []);

    useEffect(() => {
        if (selectedBucket) {
            loadObjects();
        } else {
            setObjects([]);
        }
    }, [selectedBucket, currentPrefix]);

    const loadBuckets = async () => {
        try {
            const data = await getBuckets();
            setBuckets(data);
            if (data.length > 0 && !selectedBucket) {
                setSelectedBucket(data[0]?.id || '');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load buckets');
        }
    };

    const loadObjects = async () => {
        if (!selectedBucket) return;

        setLoading(true);
        setError(null);
        try {
            const data = await listObjects(selectedBucket, currentPrefix);
            setObjects(data);
            setSelectedItems(new Set());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBucket = async (bucketId: string) => {
        if (!confirm('Are you sure you want to delete this bucket?')) return;

        try {
            await deleteBucket(bucketId);
            await loadBuckets();
            if (selectedBucket === bucketId) {
                setSelectedBucket('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete bucket');
        }
    };

    const handleUpload = async (files: FileList) => {
        if (!selectedBucket || files.length === 0) return;

        setUploading(true);
        setUploadProgress(0);
        try {
            await uploadFiles(selectedBucket, Array.from(files), currentPrefix, setUploadProgress);
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload files');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (obj: FileObject) => {
        if (!confirm(`Delete ${obj.isFolder ? 'folder' : 'file'} "${obj.name}"?`)) return;

        try {
            const fullPath = currentPrefix + obj.name;
            await deleteObject(selectedBucket, fullPath, obj.isFolder);
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleBatchDelete = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;

        try {
            const objectsToDelete = objects
                .filter((obj: FileObject) => selectedItems.has(obj.name))
                .map((obj: FileObject) => ({
                    name: currentPrefix + obj.name,
                    isFolder: obj.isFolder,
                }));

            await batchDelete(selectedBucket, objectsToDelete);
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to batch delete');
        }
    };

    const handleDownload = async (obj: FileObject) => {
        try {
            const fullPath = currentPrefix + obj.name;
            const url = await getDownloadUrl(selectedBucket, fullPath);
            window.open(url, '_blank');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to get download link');
        }
    };

    const navigateToFolder = (obj: FileObject) => {
        if (obj.isFolder) {
            setCurrentPrefix(obj.prefix || currentPrefix + obj.name + '/');
        }
    };

    const toggleSelection = (name: string) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(name)) {
            newSelection.delete(name);
        } else {
            newSelection.add(name);
        }
        setSelectedItems(newSelection);
    };

    const isAdmin = user?.role === 'admin';

    const bucketOptions = buckets.map(b => ({
        id: b.id,
        name: b.display_name || b.bucket_name
    }));

    const headerActions = document.getElementById('header-actions');

    return (
        <div className="w-full h-full flex flex-col">
            {headerActions && createPortal(
                <div className="flex items-center gap-2">
                    {error && (
                        <div className="mr-2 flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-full border border-red-200 dark:border-red-800">
                            <AlertCircle className="w-4 h-4" />
                            <span>{error}</span>
                        </div>
                    )}
                    <Select
                        value={selectedBucket}
                        onChange={setSelectedBucket}
                        options={bucketOptions}
                        className="w-64"
                    />

                    {isAdmin && selectedBucket && (
                        <button
                            onClick={() => handleDeleteBucket(selectedBucket)}
                            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                            title="Delete Bucket"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                </div>,
                headerActions
            )}

            {/* Toolbar */}
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                <div>
                    {selectedItems.size > 0 && (
                        <button
                            onClick={handleBatchDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                        >
                            <Trash2 className="w-5 h-5" />
                            <span className="hidden sm:inline">Delete ({selectedItems.size})</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadObjects()}
                        disabled={!selectedBucket}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh"
                    >
                        <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <label className={`flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer transition-colors ${!selectedBucket ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                        <Upload className="w-5 h-5" />
                        <span className="hidden sm:inline">Upload Files</span>
                        <input
                            type="file"
                            multiple
                            disabled={!selectedBucket}
                            onChange={(e) => e.target.files && handleUpload(e.target.files)}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
                        <tr>
                            <th className="w-12 px-4 py-3">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    disabled={!selectedBucket || objects.length === 0}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedItems(new Set(objects.map(o => o.name)));
                                        } else {
                                            setSelectedItems(new Set());
                                        }
                                    }}
                                    checked={objects.length > 0 && selectedItems.size === objects.length}
                                />
                            </th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Size</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Modified</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
                                        <span>Loading files...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : !selectedBucket ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <HardDrive className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <span className="text-lg font-medium">No Bucket Selected</span>
                                        <span className="text-sm">Please select a bucket from the top right to view files.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : objects.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <FolderPlus className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <span className="text-lg font-medium">Empty Bucket</span>
                                        <span className="text-sm">Upload files to get started.</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            objects.map((obj: FileObject) => (
                                <tr key={obj.name} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(obj.name)}
                                            onChange={() => toggleSelection(obj.name)}
                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => obj.isFolder && navigateToFolder(obj)}
                                            className={`flex items-center gap-2 text-left ${obj.isFolder ? 'text-primary-600 hover:text-primary-700 font-medium' : 'text-gray-900 dark:text-white'}`}
                                        >
                                            {obj.isFolder ? <span className="text-xl">📁</span> : <span className="text-xl">📄</span>}
                                            {obj.name}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {obj.isFolder ? '-' : `${(obj.size / 1024).toFixed(2)} KB`}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                        {new Date(obj.lastModified).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {!obj.isFolder && (
                                                <button
                                                    onClick={() => handleDownload(obj)}
                                                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(obj)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {uploading && (
                <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border">
                    <div className="mb-2 text-sm font-medium">Uploading...</div>
                    <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-600 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{uploadProgress.toFixed(0)}%</div>
                </div>
            )}
        </div>
    );
};

export default MinIOManagerPage;
