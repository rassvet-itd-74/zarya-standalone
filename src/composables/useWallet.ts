import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { readConfig } from '../services/configService';
import { getBalance, getChain } from '../services/zaryaService';
import { useExportKey } from './useExportKey';

export function useWallet() {
  const { currentAddress, navigate } = useAppState();

  const { exportStatusKey, exportStatusMsg, exporting, onExport } = useExportKey();

  const balance         = ref('...');
  const blockNumber     = ref('');

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
