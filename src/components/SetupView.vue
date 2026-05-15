<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { createKey } from '../services/electronService';

const { t } = useI18n();
const { afterUnlock } = useAppState();

const password = ref('');
const confirm  = ref('');
const errorKey = ref('');
const errorMsg = ref('');
const loading  = ref(false);

async function onSubmit(): Promise<void> {
  errorKey.value = ''; errorMsg.value = '';
  if (!password.value) { errorKey.value = 'setup.errorRequired'; return; }
  if (password.value !== confirm.value) { errorKey.value = 'setup.errorMismatch'; return; }
  loading.value = true;
  try {
    const address = await createKey(password.value);
    await afterUnlock(address);
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="setup-form">
    <h2 class="setup-form__title">{{ t('setup.title') }}</h2>
    <p class="setup-form__description">{{ t('setup.description') }}</p>
    <div class="field">
      <label class="field__label" for="create-password">{{ t('setup.passwordLabel') }}</label>
      <input
        id="create-password"
        v-model="password"
        class="field__input"
        type="password"
        autocomplete="new-password"
      />
    </div>
    <div class="field">
      <label class="field__label" for="create-confirm">{{ t('setup.confirmLabel') }}</label>
      <input
        id="create-confirm"
        v-model="confirm"
        class="field__input"
        type="password"
        autocomplete="new-password"
        @keydown.enter="onSubmit"
      />
    </div>
    <button class="btn" :disabled="loading" @click="onSubmit">
      {{ loading ? t('setup.generating') : t('setup.generateBtn') }}
    </button>
    <p class="setup-form__error">{{ errorKey ? t(errorKey) : errorMsg }}</p>
  </div>
</template>
