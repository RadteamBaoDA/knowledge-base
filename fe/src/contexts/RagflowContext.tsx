import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { userPreferences } from '../services/userPreferences';

interface RagflowSource {
    id: string;
    name: string;
    url: string;
}

interface RagflowConfig {
    aiChatUrl: string;
    aiSearchUrl: string;
    chatSources: RagflowSource[];
    searchSources: RagflowSource[];
}

interface RagflowContextType {
    config: RagflowConfig | null;
    selectedChatSourceId: string;
    selectedSearchSourceId: string;
    setSelectedChatSource: (id: string) => void;
    setSelectedSearchSource: (id: string) => void;
    isLoading: boolean;
    error: string | null;
}

const RagflowContext = createContext<RagflowContextType | undefined>(undefined);

async function fetchRagflowConfig(): Promise<RagflowConfig> {
    const response = await fetch('/api/ragflow/config', {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch RAGFlow config');
    }
    return response.json();
}

interface RagflowProviderProps {
    children: ReactNode;
}

export function RagflowProvider({ children }: RagflowProviderProps) {
    const { user } = useAuth();
    const [config, setConfig] = useState<RagflowConfig | null>(null);
    const [selectedChatSourceId, setSelectedChatSourceId] = useState<string>('');
    const [selectedSearchSourceId, setSelectedSearchSourceId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch config and load saved preferences
    useEffect(() => {
        const init = async () => {
            try {
                const data = await fetchRagflowConfig();
                setConfig(data);

                // Initialize chat source
                if (data.chatSources.length > 0) {
                    let chatSourceId = data.chatSources[0].id;
                    if (user?.id) {
                        const saved = await userPreferences.get<string>(user.id, 'ragflow_source_chat');
                        if (saved && data.chatSources.some(s => s.id === saved)) {
                            chatSourceId = saved;
                        }
                    }
                    setSelectedChatSourceId(chatSourceId);
                }

                // Initialize search source
                if (data.searchSources.length > 0) {
                    let searchSourceId = data.searchSources[0].id;
                    if (user?.id) {
                        const saved = await userPreferences.get<string>(user.id, 'ragflow_source_search');
                        if (saved && data.searchSources.some(s => s.id === saved)) {
                            searchSourceId = saved;
                        }
                    }
                    setSelectedSearchSourceId(searchSourceId);
                }
            } catch (err) {
                console.error('[RagflowContext] Failed to fetch config:', err);
                setError('Failed to load RAGFlow configuration');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [user?.id]);

    const setSelectedChatSource = useCallback(async (id: string) => {
        setSelectedChatSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'ragflow_source_chat', id);
        }
    }, [user?.id]);

    const setSelectedSearchSource = useCallback(async (id: string) => {
        setSelectedSearchSourceId(id);
        if (user?.id) {
            await userPreferences.set(user.id, 'ragflow_source_search', id);
        }
    }, [user?.id]);

    return (
        <RagflowContext.Provider
            value={{
                config,
                selectedChatSourceId,
                selectedSearchSourceId,
                setSelectedChatSource,
                setSelectedSearchSource,
                isLoading,
                error,
            }}
        >
            {children}
        </RagflowContext.Provider>
    );
}

export function useRagflow(): RagflowContextType {
    const context = useContext(RagflowContext);
    if (context === undefined) {
        throw new Error('useRagflow must be used within a RagflowProvider');
    }
    return context;
}
