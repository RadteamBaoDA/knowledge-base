import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';
import { useTranslation } from 'react-i18next';

interface RagflowIframeProps {
  path: "chat" | "search";
}

interface RagflowConfig {
  aiChatUrl: string;
  aiSearchUrl: string;
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
  const { t } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [configLoading, setConfigLoading] = useState(true);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useSharedUser();

  // Fetch RAGFlow config on mount
  useEffect(() => {
    fetchRagflowConfig()
      .then((config) => {
        // Use direct RAGFlow URL from config
        const url = path === 'chat' ? config.aiChatUrl : config.aiSearchUrl;
        
        if (!url) {
          setError(`RAGFlow ${path} URL is not configured`);
        } else {
          setIframeSrc(url);
        }
        setConfigLoading(false);
      })
      .catch((err) => {
        console.error('[RagflowIframe] Failed to fetch config:', err);
        setError('Failed to load RAGFlow configuration');
        setConfigLoading(false);
      });
  }, [path]);

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

  return (
    <div className="w-full h-[calc(100vh-140px)] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800 relative">
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
  );
}

export default RagflowIframe;
