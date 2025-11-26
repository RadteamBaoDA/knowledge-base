import { useQuery } from '@tanstack/react-query';

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

async function fetchChatSessions(): Promise<ChatSession[]> {
  const response = await fetch('/api/chat/sessions');
  if (!response.ok) {
    throw new Error('Failed to fetch chat sessions');
  }
  const data = await response.json() as { sessions: ChatSession[] };
  return data.sessions;
}

function HistoryPage() {
  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['chatSessions'],
    queryFn: fetchChatSessions,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-500">
        Loading chat history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-lg">
        Error loading chat history: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  if (!sessions?.length) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-500">
        No chat history yet. Start a conversation in AI Chat!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="bg-white border border-slate-200 rounded-lg p-6 cursor-pointer transition-shadow hover:shadow-lg"
        >
          <div className="font-semibold mb-2 text-slate-800">{session.title}</div>
          <div className="text-sm text-slate-500">
            {new Date(session.updatedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
          <div className="mt-2 text-sm text-slate-400">
            {session.messages.length} messages
          </div>
        </div>
      ))}
    </div>
  );
}

export default HistoryPage;
