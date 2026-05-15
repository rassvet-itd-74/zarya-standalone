<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useCreateVoting } from '../composables/useCreateVoting';
import VotingTypePicker from './VotingTypePicker.vue';
import OrganPicker from './OrganPicker.vue';
import VotingFieldsForm from './VotingFieldsForm.vue';

const { t } = useI18n();
const {
  selectedType, resolvedOrgan, statusKey, statusMsg, statusArg, submitting,
  showOrgan, createVotingPrefill,
  onTypeSelect, onSubmit, goBack,
} = useCreateVoting();
</script>

<template>
  <div class="create-voting">
    <div class="create-voting__header">
      <button class="btn btn--ghost btn--sm" @click="goBack">{{ t('createVoting.back') }}</button>
      <h2 class="create-voting__title">{{ t('createVoting.title') }}</h2>
    </div>

    <div class="cv-step">
      <p class="cv-step__label">{{ t('createVoting.typeLabel') }}</p>
      <VotingTypePicker :selected="selectedType" @select="onTypeSelect" />
    </div>

    <template v-if="selectedType !== null">
      <OrganPicker v-if="showOrgan" v-model="resolvedOrgan" />

      <VotingFieldsForm
        :type="selectedType"
        :prefill="createVotingPrefill"
        :organ="resolvedOrgan"
        :submitting="submitting"
        @submit="onSubmit"
      />

      <p v-if="statusKey || statusMsg" class="cv-status">{{ statusKey ? t(statusKey).replace('{id}', statusArg) : statusMsg }}</p>
    </template>
  </div>
</template>
