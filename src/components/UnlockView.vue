<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useUnlock } from '../composables/useUnlock';

const { t } = useI18n();
const { password, errorKey, errorMsg, loading, importStatusKey, onUnlock, onImport } = useUnlock();
</script>

<template>
  <div class="unlock-form">
    <h2 class="unlock-form__title">{{ t('unlock.title') }}</h2>
    <div class="field">
      <label class="field__label" for="unlock-password">{{ t('unlock.passwordLabel') }}</label>
      <input
        id="unlock-password"
        v-model="password"
        class="field__input"
        type="password"
        autocomplete="current-password"
        @keydown.enter="onUnlock"
      />
    </div>
    <button class="btn" :disabled="loading" @click="onUnlock">
      {{ loading ? t('unlock.unlocking') : t('unlock.unlockBtn') }}
    </button>
    <p class="unlock-form__error">{{ errorKey ? t(errorKey) : errorMsg }}</p>
    <button class="btn btn--ghost" @click="onImport">{{ t('importBtn') }}</button>
    <p class="unlock-form__status">{{ importStatusKey ? t(importStatusKey) : '' }}</p>
  </div>
</template>
