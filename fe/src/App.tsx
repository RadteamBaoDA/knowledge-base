import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsDialog from './components/SettingsDialog';
import Layout from './components/Layout';

// Lazy load pages for code splitting
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
const AiSearchPage = lazy(() => import('./pages/AiSearchPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LogoutPage = lazy(() => import('./pages/LogoutPage'));

// Import i18n configuration
import './i18n';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/ai-chat" replace />} />
              <Route path="ai-chat" element={<AiChatPage />} />
              <Route path="ai-search" element={<AiSearchPage />} />
              <Route path="history" element={<HistoryPage />} />
            </Route>
          </Routes>
        </Suspense>

        {/* Global Settings Dialog */}
        <SettingsDialog />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
