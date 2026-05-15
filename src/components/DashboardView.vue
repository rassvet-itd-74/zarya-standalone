<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useDashboard } from '../composables/useDashboard';
import OrganTagList from './OrganTagList.vue';

const { t } = useI18n();
const { votingsCount, isOffline, navigate } = useDashboard();
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__header">
      <h2 class="dashboard__title">{{ t('dashboard.title') }}</h2>
      <span v-if="isOffline" class="dashboard__chain-badge">{{ t('dashboard.offline') }}</span>
    </div>

    <OrganTagList />

    <div class="dashboard__section dashboard__section--row">
      <span class="dashboard__label">{{ t('dashboard.activeVotingsLabel') }}</span>
      <span class="dashboard__count-badge">{{ votingsCount }}</span>
    </div>

    <div class="dashboard__nav">
      <button class="btn" @click="navigate('votings')">{{ t('dashboard.votingsBtn') }}</button>
      <button class="btn btn--outline" @click="navigate('matrix')">{{ t('dashboard.matrixBtn') }}</button>
      <button class="btn btn--ghost" @click="navigate('settings')">{{ t('dashboard.settingsBtn') }}</button>
    </div>
  </div>
</template>
