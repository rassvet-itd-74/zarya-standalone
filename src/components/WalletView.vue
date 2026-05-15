<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { exportKey } from '../services/electronService';
import { readConfig } from '../services/configService';
import { getBalance, getChain } from '../services/zaryaService';

const { t } = useI18n();
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

onMounted(load);

async function onBack(): Promise<void> {
  if (currentAddress.value) {
    const config = await readConfig();
    if (config) { navigate('dashboard'); return; }
    navigate('settings');
    return;
  }
  navigate('unlock');
}
</script>

<template>
  <div class="wallet">
    <h2 class="wallet__title">{{ t('wallet.title') }}</h2>
    <p class="wallet__label">{{ t('wallet.addressLabel') }}</p>
    <code class="wallet__address">{{ currentAddress }}</code>
    <div class="wallet__address-block">
      <span class="wallet__label">{{ t('dashboard.balanceLabel') }}</span>
      <span class="wallet__balance">{{ balance }}</span>
    </div>
    <p v-if="blockNumber" class="wallet__muted">{{ t('dashboard.block') }} #{{ blockNumber }}</p>
    <div class="wallet__actions">
      <button class="btn btn--outline" :disabled="exporting" @click="onExport">
        {{ t('wallet.exportBtn') }}
      </button>
      <button class="btn btn--ghost" @click="navigate('settings')">{{ t('settings.openBtn') }}</button>
      <button class="btn btn--ghost" @click="onBack">{{ t('dashboard.backBtn') }}</button>
    </div>
    <p class="wallet__status">{{ exportStatusKey ? t(exportStatusKey) : exportStatusMsg }}</p>
  </div>
</template>
