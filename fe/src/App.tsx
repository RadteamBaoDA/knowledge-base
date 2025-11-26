import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AiChatPage from './pages/AiChatPage';
import AiSearchPage from './pages/AiSearchPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';
import LogoutPage from './pages/LogoutPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/ai-chat" replace />} />
        <Route path="ai-chat" element={<AiChatPage />} />
        <Route path="ai-search" element={<AiSearchPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
    </Routes>
  );
}

export default App;
