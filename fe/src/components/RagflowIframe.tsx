/**
 * @fileoverview RAGFlow iframe container component with i18n support.
 * 
 * Embeds RAGFlow AI Chat or AI Search interfaces in an iframe.
 * Handles:
 * - URL status checking before loading
 * - Loading states and error handling
 * - Custom error pages for different error types
 * - Locale appending to iframe URLs
 * - Iframe reload functionality
 * - All error messages internationalized via i18next
 * 
 * @module components/RagflowIframe
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';
import { useTranslation } from 'react-i18next';
import { useRagflow } from '../contexts/RagflowContext';
import { AlertCircle, RefreshCw, WifiOff, Lock, FileQuestion, ServerCrash } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

/** Props for RagflowIframe component */
interface RagflowIframeProps {
  /** The type of RAGFlow interface to embed */
  path: "chat" | "search";
}

/** Error state for iframe loading failures */
interface IframeError {
  /** Type of error for styling and messaging */
  type: 'network' | 'forbidden' | 'notfound' | 'server' | 'unknown';
  /** HTTP status code if available */
  statusCode?: number;
  /** Error message to display */
  message: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * RAGFlow iframe container with error handling and loading states.
 * 
 * Embeds the RAGFlow Chat or Search interface based on the path prop.
 * Includes URL validation, custom error pages, and retry functionality.
 * 
 * @param path - 'chat' or 'search' to determine which interface to load
 */
function RagflowIframe({ path }: RagflowIframeProps) {
  const { t, i18n } = useTranslation();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // State management
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState<IframeError | null>(null);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [urlChecked, setUrlChecked] = useState(false);
  
  // Get user and RAGFlow configuration
  const { user } = useSharedUser();
  const ragflow = useRagflow();

  // Get the selected source ID based on path (chat or search)
  const selectedSourceId = path === 'chat' ? ragflow.selectedChatSourceId : ragflow.selectedSearchSourceId;

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Effect: Update iframe source URL when source or locale changes.
   * Appends current locale to URL for internationalization.
   */
  useEffect(() => {
    if (!ragflow.config || !selectedSourceId) return;

    // Get sources array based on path type
    const sources = path === 'chat' ? ragflow.config.chatSources : ragflow.config.searchSources;
    const source = sources.find(s => s.id === selectedSourceId);

    if (source) {
      // Append locale query parameter to URL
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
        setUrlChecked(false);
      }
    }
  }, [ragflow.config, selectedSourceId, i18n.language, path]);

  // ============================================================================
  // Callbacks
  // ============================================================================

  /**
   * Check URL availability before loading iframe.
   * Uses no-cors mode since we can't read status due to CORS.
   * Detects network errors and timeouts.
   * 
   * @param url - The URL to check
   */
  const checkUrlStatus = useCallback(async (url: string) => {
    if (!url) return;

    setIsCheckingUrl(true);
    setIframeError(null);

    try {
      // Create abort controller for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Attempt HEAD request with no-cors (can't read status, but detects network errors)
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If we reach here without error, assume service is accessible
      setUrlChecked(true);
      setIframeError(null);
    } catch (error: any) {
      console.error('[RagflowIframe] URL check failed:', error);

      // Classify error type for appropriate error page
      if (error.name === 'AbortError') {
        setIframeError({
          type: 'network',
          message: t('iframe.connectionTimeout'),
        });
      } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        setIframeError({
          type: 'network',
          message: t('iframe.networkError'),
        });
      } else {
        setIframeError({
          type: 'unknown',
          message: t('iframe.unexpectedError'),
        });
      }
      setUrlChecked(true);
    } finally {
      setIsCheckingUrl(false);
    }
  }, [t]);

  /**
   * Effect: Check URL status when iframe source changes.
   */
  useEffect(() => {
    if (iframeSrc && !urlChecked) {
      checkUrlStatus(iframeSrc);
    }
  }, [iframeSrc, urlChecked, checkUrlStatus]);

  /**
   * Handler: Called when iframe successfully loads.
   * Logs the load event and clears loading/error states.
   */
  const handleIframeLoad = useCallback(() => {
    console.log('[RagflowIframe] Iframe loaded:', {
      src: iframeSrc,
      user: user?.email || 'anonymous',
    });
    setIframeLoading(false);
    setIframeError(null);
  }, [iframeSrc, user]);

  /**
   * Handler: Called when iframe fails to load.
   * Sets a generic error if no specific error is already set.
   */
  const handleIframeError = useCallback(() => {
    console.error('[RagflowIframe] Iframe failed to load:', iframeSrc);

    // Only set generic error if we don't have a specific one
    if (!iframeError) {
      setIframeError({
        type: 'unknown',
        message: t('iframe.failedToLoad'),
      });
    }
    setIframeLoading(false);
  }, [iframeSrc, iframeError, t]);

  /**
   * Effect: Reset loading state when iframe source changes.
   */
  useEffect(() => {
    if (iframeSrc) {
      setIframeLoading(true);
    }
  }, [iframeSrc]);

  /**
   * Handler: Reload the iframe by resetting its source.
   * Uses a small delay to ensure clean reload.
   */
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

  // ============================================================================
  // Render Helpers
  // ============================================================================

  /**
   * Render a custom error page based on error type.
   * Each error type has its own icon, colors, and messaging.
   * 
   * @param error - The error to display
   * @returns JSX for the error page
   */
  const renderErrorPage = (error: IframeError) => {
    // Configuration for different error types
    const errorConfigs = {
      network: {
        icon: WifiOff,
        title: t('iframe.connectionFailed'),
        description: t('iframe.connectionFailedDesc'),
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      },
      forbidden: {
        icon: Lock,
        title: t('iframe.accessDenied'),
        description: t('iframe.accessDeniedDesc'),
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
      },
      notfound: {
        icon: FileQuestion,
        title: t('iframe.pageNotFound'),
        description: t('iframe.pageNotFoundDesc'),
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      },
      server: {
        icon: ServerCrash,
        title: t('iframe.serverError'),
        description: t('iframe.serverErrorDesc'),
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      },
      unknown: {
        icon: AlertCircle,
        title: t('iframe.errorLoading'),
        description: t('iframe.errorLoadingDesc'),
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
              {t('iframe.errorCode', { code: error.statusCode })}
            </p>
          )}
          <button
            onClick={handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
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
          <div className="text-slate-500 dark:text-slate-400">{t('iframe.checkingAvailability')}</div>
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
          <div className="text-slate-500 dark:text-slate-400">{t('iframe.preparingContent')}</div>
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
