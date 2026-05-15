<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useSettings } from '../composables/useSettings';

const { t } = useI18n();
const {
  currentAddress,
  balance, blockNumber, liveChainId, exportStatusKey, exportStatusMsg, exporting,
  contractAddress, chainId, statusKey, statusMsg, testing, saving,
  onExport, onTest, onSave, onBack,
} = useSettings();
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
