import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './contexts/SettingsContext';
import { RagflowProvider } from './contexts/RagflowContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import RoleRoute from './components/RoleRoute';
import SettingsDialog from './components/SettingsDialog';
import Layout from './components/Layout';
import { config } from './config';

// Lazy load pages for code splitting
const AiChatPage = lazy(() => import('./pages/AiChatPage'));
const AiSearchPage = lazy(() => import('./pages/AiSearchPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const LogoutPage = lazy(() => import('./pages/LogoutPage'));
const UserManagementPage = lazy(() => import('./pages/UserManagementPage'));
const SystemToolsPage = lazy(() => import('./pages/SystemToolsPage'));
const ErrorPage = lazy(() => import('./pages/ErrorPage'));
const MinIOManagerPage = lazy(() => import('./pages/MinIOManagerPage'));

// Import i18n configuration
import './i18n';

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
  </div>
);

function App() {
  // Determine default redirect path based on enabled features
  const getDefaultPath = () => {
    if (config.features.enableAiChat) return '/ai-chat';
    if (config.features.enableAiSearch) return '/ai-search';
    if (config.features.enableHistory) return '/history';
    return '/ai-chat'; // fallback
  };

  return (
    <AuthProvider>
      <SettingsProvider>
        <RagflowProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/logout" element={<LogoutPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Navigate to={getDefaultPath()} replace />} />

                {config.features.enableAiChat && (
                  <Route path="/ai-chat" element={<AiChatPage />} />
                )}

                {config.features.enableAiSearch && (
                  <Route path="/ai-search" element={<AiSearchPage />} />
                )}

                {config.features.enableHistory && (
                  <Route path="/history" element={<HistoryPage />} />
                )}

                <Route path="/user-management" element={
                  <AdminRoute>
                    <UserManagementPage />
                  </AdminRoute>
                } />
                <Route path="/system-tools" element={
                  <AdminRoute>
                    <SystemToolsPage />
                  </AdminRoute>
                } />
                <Route path="/storage" element={
                  <RoleRoute allowedRoles={['admin', 'manager']}>
                    <MinIOManagerPage />
                  </RoleRoute>
                } />

                {/* Error routes */}
                <Route path="/403" element={<ErrorPage code={403} />} />
                <Route path="/404" element={<ErrorPage code={404} />} />
                <Route path="/500" element={<ErrorPage code={500} />} />
                <Route path="*" element={<Navigate to="/404" replace />} />
              </Route>
            </Routes>
          </Suspense>
          <SettingsDialog />
        </RagflowProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
