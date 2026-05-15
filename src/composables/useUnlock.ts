import { ref } from 'vue';
import { useAppState } from './useAppState';
import { unlockKey, importKey } from '../services/electronService';
import { extractError } from './utils';

export function useUnlock() {
  const { afterUnlock } = useAppState();

  const password        = ref('');
  const errorKey        = ref('');
  const errorMsg        = ref('');
  const loading         = ref(false);
  const importStatusKey = ref('');

  async function onUnlock(): Promise<void> {
    errorKey.value = ''; errorMsg.value = '';
    if (!password.value) { errorKey.value = 'unlock.errorRequired'; return; }
    loading.value = true;
    try {
      const address = await unlockKey(password.value);
      await afterUnlock(address);
    } catch (e: unknown) {
      errorMsg.value = extractError(e);
    } finally {
      loading.value = false;
    }
  }

  async function onImport(): Promise<void> {
    importStatusKey.value = '';
    try {
      const loaded = await importKey();
      importStatusKey.value = loaded ? 'importDone' : 'importCancelled';
    } catch {
      importStatusKey.value = 'importError';
    }
  }

  return { password, errorKey, errorMsg, loading, importStatusKey, onUnlock, onImport };
}
