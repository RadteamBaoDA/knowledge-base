import { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useRagflow } from '../contexts/RagflowContext';
import { config } from '../config';
import {
  MessageSquare,
  Search,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

function UserAvatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-sm' : 'w-10 h-10 text-base';

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName}
        className={`${sizeClasses} rounded-full object-cover`}
      />
    );
  }

  const initials = user.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${sizeClasses} rounded-full bg-slate-600 dark:bg-slate-700 flex items-center justify-center text-white font-medium`}>
      {initials}
    </div>
  );
}

function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { openSettings } = useSettings();
  const ragflow = useRagflow();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/ai-chat':
        return t('pages.aiChat.title');
      case '/ai-search':
        return t('pages.aiSearch.title');
      case '/history':
        return t('pages.history.title');
      default:
        return t('common.appName');
    }
  };

  const showChatDropdown = location.pathname === '/ai-chat' && ragflow.config?.chatSources && ragflow.config.chatSources.length > 1;
  const showSearchDropdown = location.pathname === '/ai-search' && ragflow.config?.searchSources && ragflow.config.searchSources.length > 1;

  return (
    <div className="flex min-h-screen">
      <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar-bg dark:bg-slate-950 text-sidebar-text p-4 flex flex-col transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-8 pb-4 border-b border-white/10`}>
          {!isCollapsed && (
            <div className="flex items-center gap-3 text-xl font-bold text-white">
              <img
                src="/src/assets/logo.png"
                alt="Olympus FPT Knowledge Base"
                className="h-8 w-auto object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
            title={isCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {config.features.enableAiChat && (
            <NavLink to="/ai-chat" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.aiChat')}>
              <MessageSquare size={20} />
              {!isCollapsed && <span>{t('nav.aiChat')}</span>}
            </NavLink>
          )}
          {config.features.enableAiSearch && (
            <NavLink to="/ai-search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.aiSearch')}>
              <Search size={20} />
              {!isCollapsed && <span>{t('nav.aiSearch')}</span>}
            </NavLink>
          )}
          {config.features.enableHistory && (
            <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.history')}>
              <History size={20} />
              {!isCollapsed && <span>{t('nav.history')}</span>}
            </NavLink>
          )}
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10 space-y-3">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`} title={isCollapsed ? user.displayName : undefined}>
              <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{user.displayName}</div>
                  <div className="text-xs text-slate-400 truncate">{user.email}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={openSettings} className={`sidebar-link text-slate-300 hover:text-white w-full ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('common.settings')}>
            <Settings size={20} />
            {!isCollapsed && <span>{t('common.settings')}</span>}
          </button>
          <Link to="/logout" className={`sidebar-link text-slate-400 hover:text-white ${isCollapsed ? 'justify-center px-2' : ''}`} title={t('nav.signOut')}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('nav.signOut')}</span>}
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{getPageTitle()}</h1>

          {showChatDropdown && (
            <div className="relative inline-block min-w-[200px]">
              <div className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20 dark:border-primary/30 shadow-sm hover:shadow-md transition-shadow">
                <MessageSquare size={18} className="text-primary flex-shrink-0" />
                <select
                  value={ragflow.selectedChatSourceId}
                  onChange={(e) => ragflow.setSelectedChatSource(e.target.value)}
                  className="ragflow-select flex-1"
                >
                  {ragflow.config?.chatSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
                <svg className="w-4 h-4 text-primary flex-shrink-0 pointer-events-none absolute right-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}

          {showSearchDropdown && (
            <div className="relative inline-block min-w-[200px]">
              <div className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20 dark:border-primary/30 shadow-sm hover:shadow-md transition-shadow">
                <Search size={18} className="text-primary flex-shrink-0" />
                <select
                  value={ragflow.selectedSearchSourceId}
                  onChange={(e) => ragflow.setSelectedSearchSource(e.target.value)}
                  className="ragflow-select flex-1"
                >
                  {ragflow.config?.searchSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
                <svg className="w-4 h-4 text-primary flex-shrink-0 pointer-events-none absolute right-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          )}
        </header>
        <div className={`flex-1 ${location.pathname === '/ai-chat' || location.pathname === '/ai-search' ? '' : 'p-8'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
