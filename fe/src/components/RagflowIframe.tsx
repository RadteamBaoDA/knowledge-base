import { useQuery } from '@tanstack/react-query';

interface RagflowIframeProps {
  path: 'chat' | 'search';
}

interface RagflowConfig {
  aiChat: string;
  aiSearch: string;
}

async function fetchRagflowConfig(): Promise<RagflowConfig> {
  const response = await fetch('/api/ragflow/config');
  if (!response.ok) {
    throw new Error('Failed to fetch RAGFlow config');
  }
  return response.json() as Promise<RagflowConfig>;
}

function RagflowIframe({ path }: RagflowIframeProps) {
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['ragflowConfig'],
    queryFn: fetchRagflowConfig,
    staleTime: Infinity, // Config doesn't change
  });

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-140px)] border border-slate-200 rounded-lg bg-white flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="w-full h-[calc(100vh-140px)] border border-red-200 rounded-lg bg-red-50 flex items-center justify-center">
        <div className="text-red-600">Failed to load RAGFlow configuration</div>
      </div>
    );
  }

  const iframeSrc = path === 'chat' ? config.aiChat : config.aiSearch;

  return (
    <div className="w-full h-[calc(100vh-140px)] border border-slate-200 rounded-lg overflow-hidden bg-white">
      <iframe
        src={iframeSrc}
        title={`RAGFlow ${path}`}
        className="w-full h-full border-none"
        allowFullScreen
      />
    </div>
  );
}

export default RagflowIframe;
