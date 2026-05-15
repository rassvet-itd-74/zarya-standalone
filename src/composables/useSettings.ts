import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { readConfig, writeConfig, testConnection } from '../services/configService';
import { getBalance, getChain } from '../services/zaryaService';
import type { AppConfig } from '../types/config';
import { useExportKey } from './useExportKey';
import { extractError } from './utils';

const DEFAULT_CONTRACT_ADDRESS: `0x${string}` = '0x141EB27110329C82De3C95045C96f6eBF15fDc4b';
const DEFAULT_CHAIN_ID = 11155111;

export function useSettings() {
  const { currentAddress, navigate } = useAppState();

  const { exportStatusKey, exportStatusMsg, exporting, onExport } = useExportKey();

  const balance         = ref('...');
  const blockNumber     = ref('');
  const liveChainId     = ref('');

  const contractAddress = ref(DEFAULT_CONTRACT_ADDRESS);
  const chainId         = ref(String(DEFAULT_CHAIN_ID));
  const statusKey       = ref('');
  const statusMsg       = ref('');
  const testing         = ref(false);
  const saving          = ref(false);

  async function loadWallet(): Promise<void> {
    if (!currentAddress.value) return;
    balance.value = '...';
    blockNumber.value = '';
    liveChainId.value = '';
    const [balanceResult, chainResult] = await Promise.allSettled([
      getBalance(currentAddress.value),
      getChain(),
    ]);
    balance.value = balanceResult.status === 'fulfilled'
      ? `${balanceResult.value} ETH`
      : '?';
    if (chainResult.status === 'fulfilled') {
      blockNumber.value = chainResult.value.blockNumber;
      liveChainId.value = String(chainResult.value.chainId);
    }
  }

  async function onTest(): Promise<void> {
    statusKey.value = 'settings.testing'; statusMsg.value = '';
    testing.value = true;
    try {
      const id = await testConnection();
      chainId.value   = String(id);
      statusKey.value = 'settings.testSuccess'; statusMsg.value = '';
    } catch (e: unknown) {
      if (e instanceof Error) { statusMsg.value = e.message; statusKey.value = ''; }
      else                    { statusKey.value = 'settings.testFail'; statusMsg.value = ''; }
    } finally {
      testing.value = false;
    }
  }

  async function onSave(): Promise<void> {
    const addr = contractAddress.value.trim() as `0x${string}`;
    const id   = parseInt(chainId.value, 10);
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      statusKey.value = 'settings.errorInvalidAddress'; statusMsg.value = '';
      return;
    }
    if (!id || id < 1) {
      statusKey.value = 'settings.errorInvalidChainId'; statusMsg.value = '';
      return;
    }
    saving.value = true;
    try {
      const config: AppConfig = { contractAddress: addr, chainId: id };
      await writeConfig(config);
      statusKey.value = 'settings.saved'; statusMsg.value = '';
      setTimeout(() => {
        if (currentAddress.value) navigate('dashboard');
        else navigate('unlock');
      }, 800);
    } catch (e: unknown) {
      statusMsg.value = extractError(e); statusKey.value = '';
    } finally {
      saving.value = false;
    }
  }

  async function onBack(): Promise<void> {
    if (currentAddress.value) {
      const config = await readConfig();
      if (config) { navigate('dashboard'); return; }
    }
    navigate('unlock');
  }

  onMounted(async () => {
    const config = await readConfig();
    contractAddress.value = config?.contractAddress ?? DEFAULT_CONTRACT_ADDRESS;
    chainId.value = String(config?.chainId ?? DEFAULT_CHAIN_ID);
    await loadWallet();
  });

  return {
    currentAddress,
    balance, blockNumber, liveChainId, exportStatusKey, exportStatusMsg, exporting,
    contractAddress, chainId, statusKey, statusMsg, testing, saving,
    onExport, onTest, onSave, onBack,
  };
}
