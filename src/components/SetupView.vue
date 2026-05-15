<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useSetup } from '../composables/useSetup';

const { t } = useI18n();
const { password, confirm, errorKey, errorMsg, loading, onSubmit } = useSetup();
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
