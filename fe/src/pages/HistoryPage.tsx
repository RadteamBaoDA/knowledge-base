import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../lib/api';

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

interface SearchResult {
  sessions: ChatSession[];
  total: number;
}

interface SearchParams {
  q?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

async function searchChatSessions(params: SearchParams): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  return apiFetch<SearchResult>(`/api/chat/sessions/search?${searchParams.toString()}`);
}

async function deleteChatSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/chat/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

async function deleteChatSessions(sessionIds: string[]): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>('/api/chat/sessions', {
    method: 'DELETE',
    body: JSON.stringify({ sessionIds }),
  });
}

async function deleteAllSessions(): Promise<{ deleted: number }> {
  return apiFetch<{ deleted: number }>('/api/chat/sessions', {
    method: 'DELETE',
    body: JSON.stringify({ all: true }),
  });
}

function HistoryPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Get locale for date formatting
  const dateLocale = i18n.language === 'vi' ? 'vi-VN' : i18n.language === 'ja' ? 'ja-JP' : 'en-US';

  const searchParams: SearchParams = {
    q: searchQuery || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 50,
  };

  const {
    data: result,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['chatSessions', searchParams],
    queryFn: () => searchChatSessions(searchParams),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChatSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteChatSessions,
    onSuccess: () => {
      setSelectedSessions(new Set());
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllSessions,
    onSuccess: () => {
      setSelectedSessions(new Set());
      setDeleteAllConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['chatSessions'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
  };

  const toggleSessionSelection = (sessionId: string) => {
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(sessionId)) {
      newSelected.delete(sessionId);
    } else {
      newSelected.add(sessionId);
    }
    setSelectedSessions(newSelected);
  };

  const toggleSelectAll = () => {
    if (!result?.sessions) return;
    
    if (selectedSessions.size === result.sessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(result.sessions.map(s => s.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedSessions.size > 0) {
      bulkDeleteMutation.mutate(Array.from(selectedSessions));
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteAll = () => {
    deleteAllMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 text-slate-500 dark:text-slate-400">
        {t('history.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-4 rounded-lg">
        {t('history.errorLoading')}: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const sessions = result?.sessions ?? [];

  return (
    <div className="space-y-6">
      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('history.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder={t('history.startDate')}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder={t('history.endDate')}
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn btn-primary"
              >
                🔍 {t('history.search')}
              </button>
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn btn-secondary"
              >
                {t('history.clear')}
              </button>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t('history.sessionsFound', { count: result?.total ?? 0 })}
            </span>
          </div>
        </form>
      </div>

      {/* Bulk Actions */}
      {sessions.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSessions.size === sessions.length && sessions.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">{t('history.selectAll')}</span>
            </label>
            {selectedSessions.size > 0 && (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('history.selected', { count: selectedSessions.size })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {selectedSessions.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn bg-red-500 text-white hover:bg-red-600"
                disabled={bulkDeleteMutation.isPending}
              >
                🗑️ {t('history.deleteSelected', { count: selectedSessions.size })}
              </button>
            )}
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="btn bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
            >
              🗑️ {t('history.deleteAll')}
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="flex justify-center items-center h-48 text-slate-500 dark:text-slate-400">
          {searchQuery || startDate || endDate
            ? t('history.noMatchingResults')
            : t('history.noHistory')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`bg-white dark:bg-slate-800 border rounded-lg p-6 transition-all ${
                selectedSessions.has(session.id)
                  ? 'border-primary bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:shadow-lg'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <input
                    type="checkbox"
                    checked={selectedSessions.has(session.id)}
                    onChange={() => toggleSessionSelection(session.id)}
                    className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-semibold mb-2 text-slate-800 dark:text-slate-100">{session.title}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {new Date(session.updatedAt).toLocaleDateString(dateLocale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="mt-2 text-sm text-slate-400 dark:text-slate-500">
                      {t('history.messageCount', { count: session.messages.length })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(session.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title={t('history.deleteSession')}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">{t('history.confirmDelete')}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t('history.confirmDeleteMessage', { count: selectedSessions.size })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="btn bg-red-500 text-white hover:bg-red-600"
              >
                {bulkDeleteMutation.isPending ? t('history.deleting') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {deleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">⚠️ {t('history.deleteAllTitle')}</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {t('history.deleteAllMessage')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteAllConfirm(false)}
                className="btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleteAllMutation.isPending}
                className="btn bg-red-500 text-white hover:bg-red-600"
              >
                {deleteAllMutation.isPending ? t('history.deleting') : t('history.deleteAll')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
