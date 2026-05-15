import { ref, watch } from 'vue';

const STORAGE_KEY = 'theme';

const isDark = ref<boolean>(
  (localStorage.getItem(STORAGE_KEY) ?? 'light') === 'dark',
);

// Keep <html data-theme> in sync with the ref.
watch(
  isDark,
  (dark) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  },
  { immediate: true },
);

export function useTheme() {
  function toggle(): void {
    isDark.value = !isDark.value;
  }

  return { isDark, toggle };
}
