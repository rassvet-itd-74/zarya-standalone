<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { unlockKey, importKey } from '../services/electronService';

const { t } = useI18n();
const { afterUnlock } = useAppState();

const password        = ref('');
const errorKey        = ref('');
const errorMsg        = ref('');
const loading         = ref(false);
const importStatusKey = ref('');

async function onUnlock(): Promise<void> {
  errorKey.value = ''; errorMsg.value = '';
  if (!password.value) { errorKey.value = 'unlock.errorRequired'; return; }
  loading.value = true;
  try {
    const address = await unlockKey(password.value);
    await afterUnlock(address);
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function onImport(): Promise<void> {
  importStatusKey.value = '';
  try {
    const loaded = await importKey();
    importStatusKey.value = loaded ? 'importDone' : 'importCancelled';
  } catch {
    importStatusKey.value = 'importError';
  }
}
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
