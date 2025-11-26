import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { SettingsProvider } from './contexts/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsDialog from './components/SettingsDialog';
import Layout from './components/Layout';
import AiChatPage from './pages/AiChatPage';
import AiSearchPage from './pages/AiSearchPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import LogoutPage from './pages/LogoutPage';

// Import i18n configuration
import './i18n';

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
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
        
        {/* Global Settings Dialog */}
        <SettingsDialog />
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
