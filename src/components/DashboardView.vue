<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { getChain, getLogs } from '../services/zaryaService';
import OrganTagList from './OrganTagList.vue';

const { t } = useI18n();
const { currentAddress, isOffline, navigate } = useAppState();

const votingsCount = ref('...');

async function countActiveVotings(): Promise<number> {
  const [created, finalized] = await Promise.all([
    getLogs('VotingCreated'),
    getLogs('VotingFinalized'),
  ]);
  const finalizedIds = new Set(
    finalized.map(log =>
      ((log as Record<string, unknown>).args as Record<string, unknown>)?.votingId?.toString(),
    ),
  );
  const now = Math.floor(Date.now() / 1000);
  return created.filter(log => {
    const args = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
    return !finalizedIds.has(args.votingId?.toString()) && Number(args.endTime ?? 0) > now;
  }).length;
}

async function load(): Promise<void> {
  votingsCount.value = '...';

  const [chainResult, votingsResult] = await Promise.allSettled([
    getChain(),
    countActiveVotings(),
  ]);

  if (chainResult.status === 'fulfilled') {
    isOffline.value  = false;
  } else {
    isOffline.value   = true;
  }

  votingsCount.value = votingsResult.status === 'fulfilled'
    ? String(votingsResult.value)
    : '?';
}

onMounted(load);
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
