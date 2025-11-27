import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function LoginPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const redirect = searchParams.get('redirect') || '/ai-chat';
  const { isAuthenticated, isLoading } = useAuth();

  // Apply theme class to document for login page (since it's outside Layout)
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // If already authenticated, redirect to intended destination
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[Login] Already authenticated, redirecting to:', redirect);
      navigate(redirect, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, redirect]);

  const handleLogin = () => {
    // Redirect to backend Azure AD login with redirect parameter
    const loginUrl = `${API_BASE_URL}/api/auth/login?redirect=${encodeURIComponent(window.location.origin + redirect)}`;
    console.log('[Login] Redirecting to:', loginUrl);
    window.location.href = loginUrl;
  };

  const handleDevLogin = async () => {
    // For development: create a real session with dev user
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ redirect }),
      });

      if (response.ok) {
        console.log('[Login] Dev login successful, navigating to:', redirect);
        // Navigate to the redirect URL
        navigate(redirect, { replace: true });
      } else {
        const error = await response.json();
        console.error('[Login] Dev login failed:', error);
      }
    } catch (err) {
      console.error('[Login] Dev login error:', err);
    }
  };

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">{t('common.checkingSession')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              src="/src/assets/logo.png"
              alt="Olympus FPT Knowledge Base"
              className="h-16 w-auto object-contain"
            />
          </div>
          <p className="text-slate-600 dark:text-slate-400">{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {t('login.error')}: {decodeURIComponent(error)}
          </div>
        )}

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
            {t('login.signInMicrosoft')}
          </button>

          {import.meta.env.DEV && (
            <button
              onClick={handleDevLogin}
              className="w-full btn btn-secondary py-3 text-base"
            >
              {t('login.devUser')}
            </button>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
          {t('login.signInPrompt')}
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
