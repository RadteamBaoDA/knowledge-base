/**
 * @fileoverview Knowledge Base Documents page (MinIO storage manager).
 * 
 * File manager interface for document storage using MinIO:
 * - Browse document buckets (configurations stored in database)
 * - Browse files and folders in realtime from MinIO
 * - Upload files with progress indicator
 * - Download files
 * - Delete files and folders (single and batch)
 * - Navigate folder hierarchy with i18n support
 * 
 * Available to admins and managers.
 * 
 * @module pages/MinIOManagerPage
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HardDrive, Trash2, Upload, Download, AlertCircle, RefreshCw, FolderPlus, Plus, X, ChevronDown, ChevronRight, Home, ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Select } from '../components/Select';
import {
    MinioBucket,
    FileObject,
    AvailableBucket,
    getBuckets,
    getAvailableBuckets,
    createBucket,
    deleteBucket,
    listObjects,
    uploadFiles,
    deleteObject,
    batchDelete,
    getDownloadUrl
} from '../services/minioService';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_SELECTED_BUCKET = 'minio_selected_bucket';

// ============================================================================
// Component
// ============================================================================

/**
 * MinIO storage manager page component.
 * 
 * Features:
 * - Bucket selection dropdown (rendered in header via portal)
 * - File/folder listing in realtime from MinIO
 * - Multi-select with checkbox
 * - Upload with progress indicator
 * - Download and delete actions
 * - Responsive table layout
 * 
 * Admin-only features:
 * - Add and remove bucket configurations (does not affect MinIO)
 */
const MinIOManagerPage = () => {
    const { user } = useAuth();
    const { t } = useTranslation();
    
    // Bucket and object state
    const [buckets, setBuckets] = useState<MinioBucket[]>([]);
    const [availableBuckets, setAvailableBuckets] = useState<AvailableBucket[]>([]);
    const [selectedBucket, setSelectedBucket] = useState<string>('');
    const [objects, setObjects] = useState<FileObject[]>([]);
    const [currentPrefix, setCurrentPrefix] = useState('');
    
    // Navigation history for back/forward
    const [historyStack, setHistoryStack] = useState<string[]>(['']);
    const [historyIndex, setHistoryIndex] = useState(0);
    
    // Selection state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    
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
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const uploadMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    // Handle bucket selection with localStorage persistence
    const handleBucketSelect = (bucketId: string) => {
        setSelectedBucket(bucketId);
        // Save to localStorage
        if (bucketId) {
            localStorage.setItem(STORAGE_KEY_SELECTED_BUCKET, bucketId);
        }
        // Reset navigation when switching buckets
        setCurrentPrefix('');
        setHistoryStack(['']);
        setHistoryIndex(0);
    };

    // Navigation functions
    const navigateTo = (prefix: string) => {
        // Add to history stack (remove forward history)
        const newHistory = historyStack.slice(0, historyIndex + 1);
        newHistory.push(prefix);
        setHistoryStack(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentPrefix(prefix);
    };

    const goBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentPrefix(historyStack[newIndex] || '');
        }
    };

    const goForward = () => {
        if (historyIndex < historyStack.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCurrentPrefix(historyStack[newIndex] || '');
        }
    };

    const canGoBack = historyIndex > 0;
    const canGoForward = historyIndex < historyStack.length - 1;

    // Filter objects based on search query
    const filteredObjects = searchQuery.trim()
        ? objects.filter(obj => obj.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : objects;

    // Clear search when changing prefix
    useEffect(() => {
        setSearchQuery('');
    }, [currentPrefix]);

    // Close upload menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) {
                setShowUploadMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
                // Try to restore from localStorage
                const savedBucketId = localStorage.getItem(STORAGE_KEY_SELECTED_BUCKET);
                
                // Check if saved bucket still exists in the list
                const savedBucketExists = savedBucketId && data.some(b => b.id === savedBucketId);
                
                if (savedBucketExists) {
                    // Restore saved bucket
                    setSelectedBucket(savedBucketId);
                } else {
                    // Fall back to first bucket
                    const firstBucketId = data[0]?.id || '';
                    setSelectedBucket(firstBucketId);
                    if (firstBucketId) {
                        localStorage.setItem(STORAGE_KEY_SELECTED_BUCKET, firstBucketId);
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t('minio.loadFailed'));
        }
    };

    const loadAvailableBuckets = async () => {
        try {
            const data = await getAvailableBuckets();
            setAvailableBuckets(data);
        } catch (err) {
            console.error('Failed to load available buckets:', err);
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
                setCurrentPrefix('');
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
            navigateTo(obj.prefix || currentPrefix + obj.name + '/');
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
            setCurrentPrefix('');
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
        loadAvailableBuckets();
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
                        onChange={handleBucketSelect}
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

            {/* Breadcrumb Navigation */}
            {selectedBucket && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-1 text-sm overflow-x-auto">
                    <button
                        onClick={() => navigateTo('')}
                        className="flex items-center gap-1 px-2 py-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                        title={t('minio.rootFolder')}
                    >
                        <Home className="w-4 h-4" />
                        <span className="hidden sm:inline">{t('minio.root')}</span>
                    </button>
                    {currentPrefix && currentPrefix.split('/').filter(Boolean).map((folder, index, arr) => {
                        const path = arr.slice(0, index + 1).join('/') + '/';
                        const isLast = index === arr.length - 1;
                        return (
                            <div key={path} className="flex items-center gap-1">
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => !isLast && navigateTo(path)}
                                    className={`px-2 py-1 rounded transition-colors ${
                                        isLast
                                            ? 'text-gray-900 dark:text-white font-medium bg-gray-100 dark:bg-gray-700'
                                            : 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                                    }`}
                                >
                                    {folder}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Toolbar */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                    {/* Back/Forward navigation */}
                    <div className="flex items-center gap-1 mr-2">
                        <button
                            onClick={goBack}
                            disabled={!canGoBack}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('minio.back')}
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                            onClick={goForward}
                            disabled={!canGoForward}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('minio.forward')}
                        >
                            <ArrowRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>
                    
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

                {/* Search input */}
                <div className="flex-1 max-w-md mx-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('minio.searchPlaceholder')}
                            disabled={!selectedBucket}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
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
                    
                    {/* Upload dropdown */}
                    <div className="relative" ref={uploadMenuRef}>
                        <button
                            onClick={() => setShowUploadMenu(!showUploadMenu)}
                            disabled={!selectedBucket}
                            className={`flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors ${!selectedBucket ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Upload className="w-5 h-5" />
                            <span className="hidden sm:inline">{t('minio.upload')}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showUploadMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showUploadMenu && (
                            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 overflow-hidden">
                                <button
                                    onClick={() => {
                                        fileInputRef.current?.click();
                                        setShowUploadMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <Upload className="w-5 h-5 text-primary-600" />
                                    <span>{t('minio.uploadFiles')}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        folderInputRef.current?.click();
                                        setShowUploadMenu(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t border-gray-200 dark:border-gray-700"
                                >
                                    <FolderPlus className="w-5 h-5 text-primary-600" />
                                    <span>{t('minio.uploadFolder')}</span>
                                </button>
                            </div>
                        )}
                        
                        {/* Hidden file inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            disabled={!selectedBucket}
                            onChange={(e) => e.target.files && handleUpload(e.target.files, false)}
                            className="hidden"
                        />
                        <input
                            ref={folderInputRef}
                            type="file"
                            // @ts-ignore - webkitdirectory is not in TypeScript types but is widely supported
                            webkitdirectory=""
                            directory=""
                            disabled={!selectedBucket}
                            onChange={(e) => e.target.files && handleUpload(e.target.files, true)}
                            className="hidden"
                        />
                    </div>
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
                                    disabled={!selectedBucket || filteredObjects.length === 0}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedItems(new Set(filteredObjects.map(o => o.name)));
                                        } else {
                                            setSelectedItems(new Set());
                                        }
                                    }}
                                    checked={filteredObjects.length > 0 && selectedItems.size === filteredObjects.length}
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
                        ) : filteredObjects.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                                        <span className="text-lg font-medium">{t('minio.noSearchResults')}</span>
                                        <span className="text-sm">{t('minio.noSearchResultsHint')}</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredObjects.map((obj: FileObject) => (
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
                                <select
                                    value={formData.bucket_name}
                                    onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white ${formErrors.bucket_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        }`}
                                >
                                    <option value="">{t('minio.selectBucketPlaceholder')}</option>
                                    {availableBuckets.map((bucket) => (
                                        <option key={bucket.name} value={bucket.name}>
                                            {bucket.name}
                                        </option>
                                    ))}
                                </select>
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
                                    className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                                />
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
