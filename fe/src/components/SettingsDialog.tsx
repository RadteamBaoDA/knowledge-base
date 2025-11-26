import { useTranslation } from 'react-i18next';
import { useSettings, SUPPORTED_LANGUAGES, Theme } from '../contexts/SettingsContext';
import { LanguageCode } from '../i18n';

function SettingsDialog() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage, isSettingsOpen, closeSettings } = useSettings();

  if (!isSettingsOpen) return null;

  const themes: { value: Theme; labelKey: string }[] = [
    { value: 'light', labelKey: 'settings.themeLight' },
    { value: 'dark', labelKey: 'settings.themeDark' },
    { value: 'system', labelKey: 'settings.themeSystem' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 dark:bg-black/70" 
        onClick={closeSettings}
      />
      
      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            {t('settings.title')}
          </h2>
          <button
            onClick={closeSettings}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
            aria-label={t('common.close')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Language Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('settings.language')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code as LanguageCode)}
                className={`
                  flex flex-col items-center p-3 rounded-lg border-2 transition-all
                  ${language === lang.code 
                    ? 'border-primary bg-primary/10 dark:bg-primary/20' 
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }
                `}
              >
                <span className="text-2xl mb-1">{lang.flag}</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {lang.nativeName}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Theme Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('settings.theme')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((themeOption) => (
              <button
                key={themeOption.value}
                onClick={() => setTheme(themeOption.value)}
                className={`
                  flex flex-col items-center p-3 rounded-lg border-2 transition-all
                  ${theme === themeOption.value 
                    ? 'border-primary bg-primary/10 dark:bg-primary/20' 
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }
                `}
              >
                <span className="text-2xl mb-1">
                  {themeOption.value === 'light' && '☀️'}
                  {themeOption.value === 'dark' && '🌙'}
                  {themeOption.value === 'system' && '💻'}
                </span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t(themeOption.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={closeSettings}
            className="btn btn-primary px-6"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsDialog;
