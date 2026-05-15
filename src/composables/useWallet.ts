import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { exportKey } from '../services/electronService';
import { readConfig } from '../services/configService';
import { getBalance, getChain } from '../services/zaryaService';

export function useWallet() {
  const { currentAddress, navigate } = useAppState();

  const balance         = ref('...');
  const blockNumber     = ref('');
  const exportStatusKey = ref('');
  const exportStatusMsg = ref('');
  const exporting       = ref(false);

  async function load(): Promise<void> {
    balance.value = '...';
    blockNumber.value = '';
    const [balanceResult, chainResult] = await Promise.allSettled([
      getBalance(currentAddress.value),
      getChain(),
    ]);
    balance.value = balanceResult.status === 'fulfilled'
      ? `${balanceResult.value} ETH`
      : '?';
    if (chainResult.status === 'fulfilled') {
      blockNumber.value = chainResult.value.blockNumber;
    }
  }

  async function onExport(): Promise<void> {
    exportStatusKey.value = ''; exportStatusMsg.value = '';
    exporting.value = true;
    try {
      const saved = await exportKey();
      exportStatusKey.value = saved ? 'wallet.exportDone' : 'wallet.exportCancelled';
    } catch (e: unknown) {
      exportStatusMsg.value = e instanceof Error ? e.message : String(e);
    } finally {
      exporting.value = false;
    }
  }

  async function onBack(): Promise<void> {
    if (currentAddress.value) {
      const config = await readConfig();
      if (config) { navigate('dashboard'); return; }
      navigate('settings');
      return;
    }
    navigate('unlock');
  }

  onMounted(load);

  return {
    currentAddress, navigate,
    balance, blockNumber, exportStatusKey, exportStatusMsg, exporting,
    onExport, onBack,
  };
}
