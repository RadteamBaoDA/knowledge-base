import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';
import { useTranslation } from 'react-i18next';
import { useRagflow } from '../contexts/RagflowContext';

interface RagflowIframeProps {
  path: "chat" | "search";
}

function RagflowIframe({ path }: RagflowIframeProps) {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const { user } = useSharedUser();
  const ragflow = useRagflow();

  // Get the selected source ID based on path
  const selectedSourceId = path === 'chat' ? ragflow.selectedChatSourceId : ragflow.selectedSearchSourceId;

  // Update iframe src when source or locale changes
  useEffect(() => {
    if (!ragflow.config || !selectedSourceId) return;

    const sources = path === 'chat' ? ragflow.config.chatSources : ragflow.config.searchSources;
    const source = sources.find(s => s.id === selectedSourceId);

    if (source) {
      // Append locale to URL
      const separator = source.url.includes('?') ? '&' : '?';
      const urlWithLocale = `${source.url}${separator}locale=${i18n.language}`;
      setIframeSrc(urlWithLocale);
    } else {
      // Fallback to legacy URL if source not found
      const fallbackUrl = path === 'chat' ? ragflow.config.aiChatUrl : ragflow.config.aiSearchUrl;
      if (fallbackUrl) {
        const separator = fallbackUrl.includes('?') ? '&' : '?';
        setIframeSrc(`${fallbackUrl}${separator}locale=${i18n.language}`);
      }
    }
  }, [ragflow.config, selectedSourceId, i18n.language, path]);

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

  if (ragflow.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (ragflow.error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20">
        <div className="text-red-600 dark:text-red-400">{ragflow.error}</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex-1 overflow-hidden bg-white dark:bg-slate-800 relative">
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
