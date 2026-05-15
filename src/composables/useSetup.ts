import { ref } from 'vue';
import { useAppState } from './useAppState';
import { createKey } from '../services/electronService';

export function useSetup() {
  const { afterUnlock } = useAppState();

  const password = ref('');
  const confirm  = ref('');
  const errorKey = ref('');
  const errorMsg = ref('');
  const loading  = ref(false);

  async function onSubmit(): Promise<void> {
    errorKey.value = ''; errorMsg.value = '';
    if (!password.value) { errorKey.value = 'setup.errorRequired'; return; }
    if (password.value !== confirm.value) { errorKey.value = 'setup.errorMismatch'; return; }
    loading.value = true;
    try {
      const address = await createKey(password.value);
      await afterUnlock(address);
    } catch (e: unknown) {
      errorMsg.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  return { password, confirm, errorKey, errorMsg, loading, onSubmit };
}
