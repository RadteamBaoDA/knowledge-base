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
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, Upload, Download, AlertCircle, RefreshCw, FolderPlus, Plus, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Select } from '../components/Select';
import {
    MinioBucket,
    FileObject,
    getBuckets,
    createBucket,
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
    const { t } = useTranslation();
    
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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [formData, setFormData] = useState({ bucket_name: '', display_name: '', description: '' });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [createError, setCreateError] = useState<string | null>(null);

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
            setError(err instanceof Error ? err.message : t('minio.loadFailed'));
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
            setError(err instanceof Error ? err.message : t('minio.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBucket = async (bucketId: string) => {
        if (!confirm(t('minio.deleteBucketConfirm'))) return;

        try {
            await deleteBucket(bucketId);
            await loadBuckets();
            if (selectedBucket === bucketId) {
                setSelectedBucket('');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('minio.deleteFailed'));
        }
    };

    const handleUpload = async (files: FileList, preserveFolderStructure: boolean = false) => {
        if (!selectedBucket || files.length === 0) return;

        setUploading(true);
        setUploadProgress(0);
        try {
            await uploadFiles(selectedBucket, Array.from(files), currentPrefix, setUploadProgress, preserveFolderStructure);
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('minio.uploadFailed'));
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (obj: FileObject) => {
        if (!confirm(t('minio.deleteConfirm', { type: obj.isFolder ? t('minio.folder') : t('minio.file'), name: obj.name }))) return;

        try {
            const fullPath = currentPrefix + obj.name;
            await deleteObject(selectedBucket, fullPath, obj.isFolder);
            await loadObjects();
        } catch (err) {
            setError(err instanceof Error ? err.message : t('minio.deleteFailed'));
        }
    };

    const handleBatchDelete = async () => {
        if (selectedItems.size === 0) return;
        if (!confirm(t('minio.batchDeleteConfirm', { count: selectedItems.size }))) return;

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
            setError(err instanceof Error ? err.message : t('minio.deleteFailed'));
        }
    };

    const handleDownload = async (obj: FileObject) => {
        try {
            const fullPath = currentPrefix + obj.name;
            const url = await getDownloadUrl(selectedBucket, fullPath);
            window.open(url, '_blank');
        } catch (err) {
            setError(err instanceof Error ? err.message : t('minio.loadFailed'));
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

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!formData.bucket_name) {
            errors.bucket_name = t('minio.bucketNameRequired');
        } else {
            const bucketNameRegex = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
            if (!bucketNameRegex.test(formData.bucket_name)) {
                errors.bucket_name = t('minio.bucketNameInvalid');
            }
        }
        if (!formData.display_name) {
            errors.display_name = t('minio.displayNameRequired');
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateBucket = async () => {
        if (!validateForm()) return;
        setCreating(true);
        setCreateError(null);
        try {
            const newBucket = await createBucket(formData);
            await loadBuckets();
            setSelectedBucket(newBucket.id);
            setShowCreateModal(false);
            setFormData({ bucket_name: '', display_name: '', description: '' });
            setFormErrors({});
        } catch (err) {
            setCreateError(err instanceof Error ? err.message : t('minio.createFailed'));
        } finally {
            setCreating(false);
        }
    };

    const handleOpenCreateModal = () => {
        setFormData({ bucket_name: '', display_name: '', description: '' });
        setFormErrors({});
        setCreateError(null);
        setShowCreateModal(true);
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

                    {isAdmin && (
                        <button
                            onClick={handleOpenCreateModal}
                            className="p-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-sm"
                            title={t('minio.createBucket')}
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}

                    {isAdmin && selectedBucket && (
                        <button
                            onClick={() => handleDeleteBucket(selectedBucket)}
                            className="p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
                            title={t('minio.deleteBucket')}
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
                            <span className="hidden sm:inline">{t('common.delete')} ({selectedItems.size})</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadObjects()}
                        disabled={!selectedBucket}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={t('minio.refresh')}
                    >
                        <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                    <label className={`flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer transition-colors ${!selectedBucket ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                        <Upload className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('minio.uploadFiles')}</span>
                        <input
                            type="file"
                            multiple
                            disabled={!selectedBucket}
                            onChange={(e) => e.target.files && handleUpload(e.target.files, false)}
                            className="hidden"
                        />
                    </label>
                    <label className={`flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer transition-colors ${!selectedBucket ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}>
                        <FolderPlus className="w-5 h-5" />
                        <span className="hidden sm:inline">{t('minio.uploadFolder')}</span>
                        <input
                            type="file"
                            // @ts-ignore - webkitdirectory is not in TypeScript types but is widely supported
                            webkitdirectory=""
                            directory=""
                            disabled={!selectedBucket}
                            onChange={(e) => e.target.files && handleUpload(e.target.files, true)}
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
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('minio.name')}</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('minio.size')}</th>
                            <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('minio.modified')}</th>
                            <th className="text-right px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">{t('minio.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
                                        <span>{t('minio.loadingFiles')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : !selectedBucket ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <HardDrive className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <span className="text-lg font-medium">{t('minio.noBucketSelected')}</span>
                                        <span className="text-sm">{t('minio.selectBucketPrompt')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : objects.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <FolderPlus className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <span className="text-lg font-medium">{t('minio.emptyBucket')}</span>
                                        <span className="text-sm">{t('minio.uploadPrompt')}</span>
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
                                                    title={t('minio.download')}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(obj)}
                                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                                                title={t('common.delete')}
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
                    <div className="mb-2 text-sm font-medium">{t('minio.uploading')}</div>
                    <div className="w-64 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-600 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{uploadProgress.toFixed(0)}%</div>
                </div>
            )}

            {/* Create Bucket Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('minio.createBucket')}</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {createError && (
                                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{createError}</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('minio.bucketName')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.bucket_name}
                                    onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                                    placeholder={t('minio.bucketNamePlaceholder')}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${formErrors.bucket_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                />
                                {formErrors.bucket_name && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.bucket_name}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('minio.bucketNameHelper')}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('minio.displayName')} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.display_name}
                                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                                    placeholder={t('minio.displayNamePlaceholder')}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${formErrors.display_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                />
                                {formErrors.display_name && (
                                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{formErrors.display_name}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('minio.displayNameHelper')}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {t('minio.description')}
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder={t('minio.descriptionPlaceholder')}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('minio.descriptionHelper')}</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                disabled={creating}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleCreateBucket}
                                disabled={creating}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {creating ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        {t('minio.creating')}
                                    </>
                                ) : (
                                    t('minio.createBucket')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MinIOManagerPage;
