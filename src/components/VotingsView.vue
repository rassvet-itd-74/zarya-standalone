<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useVotings } from '../composables/useVotings';
import CastVotePanel from './CastVotePanel.vue';

const { t } = useI18n();
const {
  tab, loading, castTargetId, voteCounts, hasVotedMap, now,
  filteredRows, navigate,
  formatDeadline, shortAddress, formatDate, rowClass,
  refresh, openCreate,
} = useVotings();
</script>

<template>
  <div class="votings">
    <div class="votings__header">
      <button class="btn btn--ghost btn--sm" @click="navigate('dashboard')">{{ t('votings.back') }}</button>
      <h2 class="votings__title">{{ t('votings.title') }}</h2>
      <div class="votings__header-actions">
        <button class="btn btn--sm" @click="openCreate">{{ t('votings.createBtn') }}</button>
        <button class="btn btn--ghost btn--sm" :disabled="loading" @click="refresh">{{ t('votings.refresh') }}</button>
      </div>
    </div>

    <div class="votings__tabs" role="tablist">
      <button
        class="votings__tab"
        :class="{ 'votings__tab--active': tab === 'active' }"
        role="tab"
        @click="tab = 'active'"
      >{{ t('votings.tabActive') }}</button>
      <button
        class="votings__tab"
        :class="{ 'votings__tab--active': tab === 'past' }"
        role="tab"
        @click="tab = 'past'"
      >{{ t('votings.tabPast') }}</button>
    </div>

    <div class="votings__list">
      <p v-if="filteredRows.length === 0 && !loading" class="votings__empty">{{ t('votings.empty') }}</p>

      <div v-for="v in filteredRows" :key="v.id" :class="rowClass(v)">
        <div class="voting-row__header">
          <span class="voting-row__id">#{{ v.id }}</span>
          <span class="voting-row__type-badge">{{ t(`votings.types.${v.typeKey}`) }}</span>
          <span
            v-if="v.finalized"
            class="voting-row__finalized-badge"
            :class="`voting-row__finalized-badge--${v.finalizedSuccess ? 'ok' : 'fail'}`"
          >{{ v.finalizedSuccess ? t('votings.passed') : t('votings.failed') }}</span>
          <span v-else class="voting-row__deadline">{{ v.endTime <= now ? t('votings.expired') : formatDeadline(v.endTime) }}</span>
        </div>

        <div class="voting-row__meta">{{ t('votings.by') }} <code>{{ shortAddress(v.author) }}</code></div>

        <div v-if="v.proposedValue" class="voting-row__proposal"><span class="voting-row__result-label">{{ t('votings.proposal') }}:</span> {{ v.proposedValue }}</div>

        <div class="voting-row__results">
          <span class="voting-row__for"><span class="voting-row__result-label">{{ t('votings.for') }}:</span> {{ voteCounts.get(v.id)?.forVotes ?? '—' }}</span>
          <span class="voting-row__against"><span class="voting-row__result-label">{{ t('votings.against') }}:</span> {{ voteCounts.get(v.id)?.againstVotes ?? '—' }}</span>
        </div>
        <div v-if="v.finalized || v.endTime <= now" class="voting-row__ended">{{ t('votings.ended') }}: {{ formatDate(v.endTime) }}</div>

        <div class="voting-row__actions">
          <button
            v-if="!v.finalized && v.endTime > now"
            class="btn btn--sm voting-row__cast-btn"
            :disabled="hasVotedMap.get(v.id)"
            @click="castTargetId = v.id"
          >{{ hasVotedMap.get(v.id) ? t('votings.voted') : t('votings.castVote') }}</button>
        </div>
      </div>
    </div>

    <CastVotePanel
      v-if="castTargetId !== null"
      :voting-id="castTargetId"
      @done="castTargetId = null; refresh()"
      @cancel="castTargetId = null"
    />
  </div>
</template>
