import { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';
import { useRagflow } from '../contexts/RagflowContext';
import { config } from '../config';
import { Select } from './Select';
import {
  MessageSquare,
  Search,
  History,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  Server
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
  const { openSettings, resolvedTheme } = useSettings();
  const ragflow = useRagflow();

  const logoSrc = resolvedTheme === 'dark' ? '/src/assets/logo-dark.png' : '/src/assets/logo.png';

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/ai-chat':
        return t('pages.aiChat.title');
      case '/ai-search':
        return t('pages.aiSearch.title');
      case '/history':
        return t('pages.history.title');
      case '/system-tools':
        return 'System Monitoring Tools';
      default:
        return t('common.appName');
    }
  };

  const showChatDropdown = location.pathname === '/ai-chat' && ragflow.config?.chatSources && ragflow.config.chatSources.length > 1;
  const showSearchDropdown = location.pathname === '/ai-search' && ragflow.config?.searchSources && ragflow.config.searchSources.length > 1;

  return (
    <div className="flex min-h-screen">
      <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar-bg dark:bg-slate-950 text-sidebar-text flex flex-col transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b border-white/10 ${resolvedTheme === 'dark' ? '' : 'bg-white'}`}>
          {!isCollapsed && (
            <div className="flex items-center justify-start w-full transition-all duration-300">
              <img
                src={logoSrc}
                alt="Olympus FPT Knowledge Base"
                className="w-48 object-contain object-left"
              />
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`p-2 rounded-lg transition-colors ml-2 flex-shrink-0 ${resolvedTheme === 'dark' ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'}`}
            title={isCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <nav className="flex flex-col gap-2 flex-1 mt-4">
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
          {user?.role === 'admin' && (
            <NavLink to="/user-management" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title="User Management">
              <Users size={20} />
              {!isCollapsed && <span>User Management</span>}
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink to="/system-tools" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`} title="System Tools">
              <Server size={20} />
              {!isCollapsed && <span>System Tools</span>}
            </NavLink>
          )}
        </nav>

        <div className={`mt-auto pt-4 border-t border-white/10 space-y-3 pb-4 ${resolvedTheme === 'dark' ? '' : 'bg-white'}`}>
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'}`} title={isCollapsed ? user.displayName : undefined}>
              <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${resolvedTheme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{user.displayName}</div>
                  <div className={`text-xs truncate ${resolvedTheme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{user.email}</div>
                </div>
              )}
            </div>
          )}
          <button onClick={openSettings} className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''} ${resolvedTheme === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`} title={t('common.settings')}>
            <Settings size={20} />
            {!isCollapsed && <span>{t('common.settings')}</span>}
          </button>
          <Link to="/logout" className={`sidebar-link w-full ${isCollapsed ? 'justify-center px-2' : ''} ${resolvedTheme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`} title={t('nav.signOut')}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('nav.signOut')}</span>}
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 h-16 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{getPageTitle()}</h1>

          {showChatDropdown && (
            <Select
              value={ragflow.selectedChatSourceId}
              onChange={ragflow.setSelectedChatSource}
              options={ragflow.config?.chatSources || []}
              icon={<MessageSquare size={18} />}
            />
          )}

          {showSearchDropdown && (
            <Select
              value={ragflow.selectedSearchSourceId}
              onChange={ragflow.setSelectedSearchSource}
              options={ragflow.config?.searchSources || []}
              icon={<Search size={18} />}
            />
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
