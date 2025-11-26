import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  const handleLogin = async () => {
    // Redirect to backend Azure AD login
    window.location.href = '/api/auth/login';
  };

  const handleDevLogin = () => {
    // For development: skip SSO and go directly to app
    navigate('/ai-chat');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">📚 Knowledge Base</h1>
          <p className="text-slate-600">AI Chat & Search powered by RAGFlow</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            className="w-full btn btn-primary py-3 text-base flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" fill="currentColor">
              <rect x="1" y="1" width="9" height="9" />
              <rect x="11" y="1" width="9" height="9" />
              <rect x="1" y="11" width="9" height="9" />
              <rect x="11" y="11" width="9" height="9" />
            </svg>
            Sign in with Microsoft
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleDevLogin}
              className="w-full btn btn-secondary py-3 text-base"
            >
              Continue as Dev User
            </button>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Sign in to access the AI knowledge base
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
