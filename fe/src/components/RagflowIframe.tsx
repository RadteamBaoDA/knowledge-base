import { useEffect, useRef, useState, useCallback } from 'react';
import { useSharedUser } from '../hooks/useSharedUser';

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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
      })
      .catch((err) => {
        console.error('[RagflowIframe] Failed to fetch config:', err);
        setError('Failed to load RAGFlow configuration');
        setLoading(false);
      });
  }, [path]);

  // Log iframe load event
  const handleIframeLoad = useCallback(() => {
    console.log('[RagflowIframe] Iframe loaded:', {
      src: iframeSrc,
      user: user?.email || 'anonymous',
    });
  }, [iframeSrc, user]);

  if (loading) {
    return (
      <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg">
        <div className="text-slate-500">Loading RAGFlow...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[calc(100vh-140px)] flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-140px)] border border-slate-200 rounded-lg overflow-hidden bg-white">
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
