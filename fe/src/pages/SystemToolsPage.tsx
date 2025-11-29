/**
 * @fileoverview System monitoring tools page for administrators.
 * 
 * Admin-only page displaying a grid of system monitoring tools.
 * Tools are configured in system-tools.config.json on the backend.
 * Each tool opens in a new browser tab when clicked.
 * 
 * @module pages/SystemToolsPage
 */

import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCw, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getSystemTools, SystemTool } from '../services/systemToolsService';
import SystemToolCard from '../components/SystemToolCard';
import { useAuth } from '../hooks/useAuth';

// ============================================================================
// Component
// ============================================================================

/**
 * System monitoring tools page.
 * 
 * Features:
 * - Grid of clickable tool cards
 * - Loading and error states
 * - Retry functionality on error
 * - Empty state when no tools configured
 * - Admin info about configuration file location
 */
const SystemToolsPage = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    
    // State management
    const [tools, setTools] = useState<SystemTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch system tools from API.
     * Handles loading state and error capture.
     */
    const fetchTools = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await getSystemTools();
            setTools(data);
        } catch (err) {
            console.error('Failed to fetch system tools:', err);
            setError(err instanceof Error ? err.message : 'Failed to load system tools');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Effect: Load tools on component mount.
     */
    useEffect(() => {
        fetchTools();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading system tools...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4 max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Failed to Load Tools
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <button
                            onClick={fetchTools}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <Server className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        System Monitoring Tools
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Quick access to system monitoring and management tools. Click on any tool to open it in a new tab.
                </p>
            </div>

            {/* Tools Grid */}
            {tools.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                    <Server className="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        No Tools Configured
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
                        No system monitoring tools have been configured yet. Contact your administrator to add tools.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {tools.map((tool) => (
                        <SystemToolCard key={tool.id} tool={tool} />
                    ))}
                </div>
            )}

            {/* Footer info */}
            {tools.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {tools.length} tool{tools.length !== 1 ? 's' : ''} available
                        {user?.role === 'admin' && (
                            <span className="ml-2">
                                · Configuration can be updated in <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">system-tools.config.json</code>
                            </span>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
};

export default SystemToolsPage;
