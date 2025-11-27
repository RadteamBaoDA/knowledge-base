import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';
import { useTranslation } from 'react-i18next';
import { userPreferences } from '../services/userPreferences';

interface RagflowIframeProps {
  path: "chat" | "search";
}

interface RagflowSource {
  id: string;
  name: string;
  type: 'chat' | 'search';
  url: string;
}

interface RagflowConfig {
  aiChatUrl: string;
  aiSearchUrl: string;
  sources: RagflowSource[];
}

/**
 * Fetch RAGFlow config from backend
 */
async function fetchRagflowConfig(): Promise<RagflowConfig> {
  const response = await fetch('/api/ragflow/config', {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('Failed to fetch RAGFlow config');
  }
  return response.json();
}

function RagflowIframe({ path }: RagflowIframeProps) {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [config, setConfig] = useState<RagflowConfig | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [configLoading, setConfigLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSharedUser();

  // Fetch RAGFlow config on mount
  useEffect(() => {
    const init = async () => {
      try {
        const data = await fetchRagflowConfig();
        setConfig(data);

        // Filter sources by type (chat/search)
        const relevantSources = data.sources?.filter(s => s.type === path) || [];

        if (relevantSources.length > 0) {
          // Try to load saved preference if user is logged in
          let initialSourceId = relevantSources[0].id;

          if (user?.id) {
            const savedSourceId = await userPreferences.get<string>(
              user.id,
              `ragflow_source_${path}`
            );

            if (savedSourceId && relevantSources.some(s => s.id === savedSourceId)) {
              initialSourceId = savedSourceId;
            }
          }

          setSelectedSourceId(initialSourceId);
        } else {
          // Fallback to legacy URL if no sources defined
          const url = path === 'chat' ? data.aiChatUrl : data.aiSearchUrl;
          if (!url) {
            setError(`RAGFlow ${path} URL is not configured`);
          } else {
            setIframeSrc(url);
          }
        }
      } catch (err) {
        console.error('[RagflowIframe] Failed to fetch config:', err);
        setError('Failed to load RAGFlow configuration');
      } finally {
        setConfigLoading(false);
      }
    };

    init();
  }, [path, user?.id]);

  // Handle source selection change
  const handleSourceChange = useCallback(async (sourceId: string) => {
    setSelectedSourceId(sourceId);

    // Save preference if user is logged in
    if (user?.id) {
      await userPreferences.set(user.id, `ragflow_source_${path}`, sourceId);
    }
  }, [path, user?.id]);

  // Update iframe src when source or locale changes
  useEffect(() => {
    if (!config || !selectedSourceId) return;

    const source = config.sources?.find(s => s.id === selectedSourceId);
    if (source) {
      // Append locale to URL
      const separator = source.url.includes('?') ? '&' : '?';
      const urlWithLocale = `${source.url}${separator}locale=${i18n.language}`;
      setIframeSrc(urlWithLocale);
    }
  }, [config, selectedSourceId, i18n.language]);

  // Log iframe load event
  const handleIframeLoad = useCallback(() => {
    console.log('[RagflowIframe] Iframe loaded:', {
      src: iframeSrc,
      user: user?.email || 'anonymous',
    });
    setIframeLoading(false);
  }, [iframeSrc, user]);

  // Reset iframe loading state when src changes
  useEffect(() => {
    if (iframeSrc) {
      setIframeLoading(true);
    }
  }, [iframeSrc]);

  if (configLoading) {
    return (
      <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  const relevantSources = config?.sources?.filter(s => s.type === path) || [];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-140px)]">
      {/* Source Selector */}
      {relevantSources.length > 1 && (
        <div className="flex justify-end">
          <div className="relative inline-block text-left w-64">
            <select
              value={selectedSourceId}
              onChange={(e) => handleSourceChange(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            >
              {relevantSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 relative">
        {/* Loading overlay */}
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <div className="text-slate-500 dark:text-slate-400">
                {path === 'chat' ? t('iframe.loadingChat') : t('iframe.loadingSearch')}
              </div>
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title={`RAGFlow ${path}`}
          className="w-full h-full"
          style={{ border: 'none' }}
          allow="clipboard-read; clipboard-write"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}

export default RagflowIframe;
