import i18next from 'i18next';
import en from './assets/json/locales/en.json';
import ru from './assets/json/locales/ru.json';

const STORAGE_KEY = 'zarya-lang';

function getInitialLang(): string {
  return localStorage.getItem(STORAGE_KEY) ?? 'ru';
}

export async function initI18n(): Promise<void> {
  await i18next.init({
    lng: getInitialLang(),
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      ru: { translation: ru },
    },
  });
}

export function t(key: string): string {
  return i18next.t(key);
}

export async function changeLang(lang: string): Promise<void> {
  localStorage.setItem(STORAGE_KEY, lang);
  await i18next.changeLanguage(lang);
}

export function currentLang(): string {
  return i18next.language;
}
