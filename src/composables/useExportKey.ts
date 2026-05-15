import { ref } from 'vue';
import { exportKey } from '../services/electronService';
import { extractError } from './utils';

export function useExportKey() {
  const exportStatusKey = ref('');
  const exportStatusMsg = ref('');
  const exporting       = ref(false);

  async function onExport(): Promise<void> {
    exportStatusKey.value = ''; exportStatusMsg.value = '';
    exporting.value = true;
    try {
      const saved = await exportKey();
      exportStatusKey.value = saved ? 'wallet.exportDone' : 'wallet.exportCancelled';
    } catch (e: unknown) {
      exportStatusMsg.value = extractError(e);
    } finally {
      exporting.value = false;
    }
  }

  return { exportStatusKey, exportStatusMsg, exporting, onExport };
}
