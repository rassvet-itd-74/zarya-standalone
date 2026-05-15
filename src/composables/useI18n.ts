import { ref } from 'vue';
import { t as rawT, changeLang as rawChangeLang, currentLang as rawCurrentLang } from '../i18n';

// Incrementing this ref causes all reactive contexts (templates, computed) to re-evaluate.
const langVersion = ref(0);

export function useI18n() {
  // Plain function: callable as t('key') in both <script setup> and templates.
  // Accessing langVersion.value inside makes templates track the dependency and
  // re-render when the language changes.
  function t(key: string): string {
    langVersion.value; // eslint-disable-line @typescript-eslint/no-unused-expressions
    return rawT(key);
  }

  async function changeLang(lang: string): Promise<void> {
    await rawChangeLang(lang);
    langVersion.value++;
  }

  function currentLang(): string {
    return rawCurrentLang();
  }

  return { t, changeLang, currentLang };
}
