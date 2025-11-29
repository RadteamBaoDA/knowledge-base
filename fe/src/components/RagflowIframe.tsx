import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';
import { useTranslation } from 'react-i18next';
import { useRagflow } from '../contexts/RagflowContext';
import { AlertCircle, RefreshCw, WifiOff, Lock, FileQuestion, ServerCrash } from 'lucide-react';

interface RagflowIframeProps {
  path: "chat" | "search";
}

interface IframeError {
  type: 'network' | 'forbidden' | 'notfound' | 'server' | 'unknown';
  statusCode?: number;
  message: string;
}

function RagflowIframe({ path }: RagflowIframeProps) {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState<IframeError | null>(null);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlChecked, setUrlChecked] = useState(false);
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
      setUrlChecked(false); // Reset check when URL changes
    } else {
      // Fallback to legacy URL if source not found
      const fallbackUrl = path === 'chat' ? ragflow.config.aiChatUrl : ragflow.config.aiSearchUrl;
      if (fallbackUrl) {
        const separator = fallbackUrl.includes('?') ? '&' : '?';
        setIframeSrc(`${fallbackUrl}${separator}locale=${i18n.language}`);
        setUrlChecked(false); // Reset check when URL changes
      }
    }
  }, [ragflow.config, selectedSourceId, i18n.language, path]);

  // Check URL status before loading iframe
  const checkUrlStatus = useCallback(async (url: string) => {
    if (!url) return;

    setIsCheckingUrl(true);
    setIframeError(null);

    try {
      // Use a proxy endpoint to check the URL status
      // We can't directly check due to CORS, so we'll try to load it and catch errors
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors', // This won't give us status but will detect network errors
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Since we're using no-cors, we can't read the status
      // If we get here without error, assume it's accessible
      setUrlChecked(true);
      setIframeError(null);
    } catch (error: any) {
      console.error('[RagflowIframe] URL check failed:', error);

      // Determine error type
      if (error.name === 'AbortError') {
        setIframeError({
          type: 'network',
          message: 'Connection timeout. The service is taking too long to respond.',
        });
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setIframeError({
          type: 'network',
          message: 'Unable to connect to the service. Please check your network connection.',
        });
      } else {
        setIframeError({
          type: 'unknown',
          message: 'An unexpected error occurred while checking the service availability.',
        });
      }
      setUrlChecked(true);
    } finally {
      setIsCheckingUrl(false);
    }
  }, []);

  // Check URL status when src changes
  useEffect(() => {
    if (iframeSrc && !urlChecked) {
      checkUrlStatus(iframeSrc);
    }
  }, [iframeSrc, urlChecked, checkUrlStatus]);

  // Log iframe load event
  const handleIframeLoad = useCallback(() => {
    console.log('[RagflowIframe] Iframe loaded:', {
      src: iframeSrc,
      user: user?.email || 'anonymous',
    });
    setIframeLoading(false);
    setIframeError(null);
  }, [iframeSrc, user]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    console.error('[RagflowIframe] Iframe failed to load:', iframeSrc);

    // Set a generic error if we don't already have one
    if (!iframeError) {
      setIframeError({
        type: 'unknown',
        message: 'Failed to load the content. The service may be temporarily unavailable.',
      });
    }
    setIframeLoading(false);
  }, [iframeSrc, iframeError]);

  // Reset iframe loading state when src changes
  useEffect(() => {
    if (iframeSrc) {
      setIframeLoading(true);
    }
  }, [iframeSrc]);

  // Reload iframe
  const handleReload = useCallback(() => {
    setIframeLoading(true);
    setIframeError(null);
    setUrlChecked(false);
    if (iframeRef.current) {
      iframeRef.current.src = '';
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = iframeSrc;
        }
      }, 100);
    }
  }, [iframeSrc]);

  // Render error page based on error type
  const renderErrorPage = (error: IframeError) => {
    const errorConfigs = {
      network: {
        icon: WifiOff,
        title: 'Connection Failed',
        description: 'Unable to connect to the service. Please check your network connection and try again.',
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      },
      forbidden: {
        icon: Lock,
        title: 'Access Denied',
        description: 'You do not have permission to access this resource. Please contact your administrator.',
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      notfound: {
        icon: FileQuestion,
        title: 'Page Not Found',
        description: 'The requested page could not be found. The service may have been moved or is temporarily unavailable.',
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      },
      server: {
        icon: ServerCrash,
        title: 'Server Error',
        description: 'The service is experiencing technical difficulties. Please try again later.',
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      },
      unknown: {
        icon: AlertCircle,
        title: 'Error Loading Content',
        description: 'An unexpected error occurred while loading the content. Please try again.',
        color: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-800',
      },
    };

    const config = errorConfigs[error.type];
    const Icon = config.icon;

    return (
      <div className={`w-full h-full flex items-center justify-center ${config.bgColor}`}>
        <div className="text-center max-w-md px-6">
          <Icon className={`w-16 h-16 mx-auto mb-4 ${config.color}`} />
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            {config.title}
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error.message || config.description}
          </p>
          {error.statusCode && (
            <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
              Error Code: {error.statusCode}
            </p>
          )}
          <button
            onClick={handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  };

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

  // Show loading while checking URL
  if (isCheckingUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">Checking service availability...</div>
        </div>
      </div>
    );
  }

  // Show custom error page if iframe failed to load
  if (iframeError) {
    return renderErrorPage(iframeError);
  }

  // Only render iframe if URL check passed
  if (!urlChecked) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 dark:bg-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
          <div className="text-slate-500 dark:text-slate-400">Preparing content...</div>
        </div>
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
          onError={handleIframeError}
        />
      </div>
    </div>
  );
}

export default RagflowIframe;
