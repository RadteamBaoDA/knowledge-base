import { useTranslation } from 'react-i18next';
import { useSettings, SUPPORTED_LANGUAGES, Theme } from '../contexts/SettingsContext';
import { LanguageCode } from '../i18n';
import { Dialog } from './Dialog';
import { RadioGroup } from './RadioGroup';

function SettingsDialog() {
  const { t } = useTranslation();
  const { theme, setTheme, language, setLanguage, isSettingsOpen, closeSettings } = useSettings();

  const languageOptions = SUPPORTED_LANGUAGES.map(lang => ({
    value: lang.code,
    label: lang.nativeName,
    icon: lang.flag,
  }));

  const themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: t('settings.themeLight'), icon: '☀️' },
    { value: 'dark', label: t('settings.themeDark'), icon: '🌙' },
    { value: 'system', label: t('settings.themeSystem'), icon: '💻' },
  ];

  return (
    <Dialog
      open={isSettingsOpen}
      onClose={closeSettings}
      title={t('settings.title')}
      footer={
        <button onClick={closeSettings} className="btn btn-primary px-6">
          {t('common.close')}
        </button>
      }
    >
      {/* Language Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('settings.language')}
        </label>
        <RadioGroup
          value={language}
          onChange={(value) => setLanguage(value as LanguageCode)}
          options={languageOptions}
          columns={3}
        />
      </div>

      {/* Theme Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('settings.theme')}
        </label>
        <RadioGroup
          value={theme}
          onChange={(value) => setTheme(value as Theme)}
          options={themeOptions}
          columns={3}
        />
      </div>
    </Dialog>
  );
}

export default SettingsDialog;
