import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';

function Layout() {
  const location = useLocation();

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/ai-chat':
        return 'AI Chat';
      case '/ai-search':
        return 'AI Search';
      case '/history':
        return 'Chat History';
      default:
        return 'Knowledge Base';
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-bg text-sidebar-text p-6 flex flex-col">
        <div className="text-xl font-bold mb-8 pb-4 border-b border-white/10">
          📚 Knowledge Base
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLink
            to="/ai-chat"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            💬 AI Chat
          </NavLink>
          <NavLink
            to="/ai-search"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            🔍 AI Search
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            📜 History
          </NavLink>
        </nav>
        
        {/* Logout link at bottom */}
        <Link
          to="/logout"
          className="sidebar-link mt-auto text-slate-400 hover:text-white"
        >
          🚪 Sign Out
        </Link>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-slate-800">{getPageTitle()}</h1>
        </header>
        <div className="flex-1 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
