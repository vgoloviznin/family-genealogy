import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeResources, DEFAULT_LOCALE } from '@shared/locales';

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: localeResources.ru },
    en: { translation: localeResources.en },
    it: { translation: localeResources.it }
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false }
});

export default i18n;
