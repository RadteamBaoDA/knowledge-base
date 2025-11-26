import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/SettingsContext';

function LogoutPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useSettings();

  // Apply theme class to document for logout page (since it's outside Layout)
  useEffect(() => {
    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    // Redirect to backend logout which handles Azure AD SSO logout
    window.location.href = '/api/auth/logout';
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">{t('common.signingOut')}</p>
      </div>
    </div>
  );
}

export default LogoutPage;
