<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useWallet } from '../composables/useWallet';

const { t } = useI18n();
const {
  currentAddress, navigate,
  balance, blockNumber, exportStatusKey, exportStatusMsg, exporting,
  onExport, onBack,
} = useWallet();
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
