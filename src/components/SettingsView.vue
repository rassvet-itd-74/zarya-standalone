<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { readConfig, writeConfig, testConnection } from '../services/configService';
import { exportKey } from '../services/electronService';
import { getBalance, getChain } from '../services/zaryaService';
import type { AppConfig } from '../types/config';

const DEFAULT_CONTRACT_ADDRESS: `0x${string}` = '0x141EB27110329C82De3C95045C96f6eBF15fDc4b';
const DEFAULT_CHAIN_ID = 11155111;

const { t } = useI18n();
const { currentAddress, navigate } = useAppState();

const balance         = ref('...');
const blockNumber     = ref('');
const liveChainId     = ref('');
const exportStatusKey = ref('');
const exportStatusMsg = ref('');
const exporting       = ref(false);

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

onMounted(async () => {
  const config = await readConfig();
  contractAddress.value = config?.contractAddress ?? DEFAULT_CONTRACT_ADDRESS;
  chainId.value = String(config?.chainId ?? DEFAULT_CHAIN_ID);
  await loadWallet();
});

async function onTest(): Promise<void> {
  statusKey.value = 'settings.testing'; statusMsg.value = '';
  testing.value = true;
  try {
    const id = await testConnection();
    chainId.value = String(id);
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
    statusMsg.value = e instanceof Error ? e.message : String(e); statusKey.value = '';
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
</script>

<template>
  <div class="settings-form">
    <div v-if="currentAddress" class="wallet">
      <h2 class="wallet__title">{{ t('wallet.title') }}</h2>
      <p class="wallet__label">{{ t('wallet.addressLabel') }}</p>
      <code class="wallet__address">{{ currentAddress }}</code>
      <div class="wallet__address-block">
        <span class="wallet__label">{{ t('dashboard.balanceLabel') }}</span>
        <span class="wallet__balance">{{ balance }}</span>
      </div>
      <p v-if="blockNumber" class="wallet__muted">{{ t('dashboard.block') }} #{{ blockNumber }}</p>
      <p v-if="liveChainId" class="wallet__muted">Chain {{ liveChainId }}</p>
      <div class="wallet__actions">
        <button class="btn btn--outline" :disabled="exporting" @click="onExport">
          {{ t('wallet.exportBtn') }}
        </button>
      </div>
      <p class="wallet__status">{{ exportStatusKey ? t(exportStatusKey) : exportStatusMsg }}</p>
    </div>

    <h2 class="settings-form__title">{{ t('settings.title') }}</h2>
    <div class="field">
      <label class="field__label" for="contract-address">{{ t('settings.contractAddressLabel') }}</label>
      <input
        id="contract-address"
        v-model="contractAddress"
        class="field__input"
        type="text"
        autocomplete="off"
        spellcheck="false"
      />
    </div>
    <div class="field">
      <label class="field__label" for="chain-id">{{ t('settings.chainIdLabel') }}</label>
      <input
        id="chain-id"
        v-model="chainId"
        class="field__input"
        type="number"
        min="1"
      />
    </div>
    <div class="settings-form__actions">
      <button class="btn btn--ghost" :disabled="testing" @click="onTest">{{ t('settings.testBtn') }}</button>
      <button class="btn" :disabled="saving" @click="onSave">{{ t('settings.saveBtn') }}</button>
    </div>
    <p class="settings-form__status">{{ statusKey ? t(statusKey) : statusMsg }}</p>
    <button class="btn btn--ghost settings-form__back" @click="onBack">{{ t('settings.backBtn') }}</button>
  </div>
</template>
