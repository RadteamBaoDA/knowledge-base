import { useState } from 'react';
import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, User } from '../hooks/useAuth';
import { useSettings } from '../contexts/SettingsContext';

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

  // Generate initials from displayName
  const initials = user.displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`${sizeClasses} rounded-full bg-primary flex items-center justify-center text-white font-medium`}>
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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-sidebar-bg dark:bg-slate-950 text-sidebar-text p-4 flex flex-col transition-all duration-300`}>
        {/* Header with collapse toggle */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-8 pb-4 border-b border-white/10`}>
          {!isCollapsed && (
            <div className="text-xl font-bold">
              📚 {t('common.appName')}
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
            title={isCollapsed ? t('nav.expandMenu') : t('nav.collapseMenu')}
          >
            {isCollapsed ? '→' : '←'}
          </button>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          <NavLink
            to="/ai-chat"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`
            }
            title={t('nav.aiChat')}
          >
            <span>💬</span>
            {!isCollapsed && <span>{t('nav.aiChat')}</span>}
          </NavLink>
          <NavLink
            to="/ai-search"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`
            }
            title={t('nav.aiSearch')}
          >
            <span>🔍</span>
            {!isCollapsed && <span>{t('nav.aiSearch')}</span>}
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''} ${isCollapsed ? 'justify-center px-2' : ''}`
            }
            title={t('nav.history')}
          >
            <span>📜</span>
            {!isCollapsed && <span>{t('nav.history')}</span>}
          </NavLink>
        </nav>
        
        {/* User info, settings and logout at bottom */}
        <div className="mt-auto pt-4 border-t border-white/10 space-y-3">
          {user && (
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`} title={isCollapsed ? user.displayName : undefined}>
              <UserAvatar user={user} size={isCollapsed ? 'sm' : 'md'} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {user.displayName}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {user.email}
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={openSettings}
            className={`sidebar-link text-slate-300 hover:text-white w-full ${isCollapsed ? 'justify-center px-2' : ''}`}
            title={t('common.settings')}
          >
            <span>⚙️</span>
            {!isCollapsed && <span>{t('common.settings')}</span>}
          </button>
          <Link
            to="/logout"
            className={`sidebar-link text-slate-400 hover:text-white ${isCollapsed ? 'justify-center px-2' : ''}`}
            title={t('nav.signOut')}
          >
            <span>🚪</span>
            {!isCollapsed && <span>{t('nav.signOut')}</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900">
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{getPageTitle()}</h1>
        </header>
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
