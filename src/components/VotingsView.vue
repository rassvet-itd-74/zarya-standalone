<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { getLogs, watchEvent, unwatchEvent, readContract, writeContract, waitTx, onEvent } from '../services/zaryaService';
import CastVotePanel from './CastVotePanel.vue';
import type { VotingRow, VotingTab, VotingType } from '../types/voting';

const { t } = useI18n();
const { currentAddress, isOffline, navigate, createVotingPrefill } = useAppState();

const tab          = ref<VotingTab>('active');
const rows         = ref<VotingRow[]>([]);
const loading      = ref(false);
const castTargetId = ref<string | null>(null);

// Async-loaded per-row data
const voteCounts  = ref<Map<string, { forVotes: bigint; againstVotes: bigint }>>(new Map());
const hasVotedMap = ref<Map<string, boolean>>(new Map());

let countdownTick: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubEvent: (() => void) | null = null;
const now = ref(Math.floor(Date.now() / 1000));

const TYPE_EVENT_NAMES = [
  'NumericalValueVotingCreated', 'CategoricalValueVotingCreated',
  'CategoryVotingCreated', 'DecimalsVotingCreated', 'MembershipVotingCreated',
  'MembershipRevocationVotingCreated', 'ThemeVotingCreated', 'StatementVotingCreated',
] as const;

const TYPE_KEY_MAP: Record<string, VotingType> = {
  NumericalValueVotingCreated:       'numericalValue',
  CategoricalValueVotingCreated:     'categoricalValue',
  CategoryVotingCreated:             'category',
  DecimalsVotingCreated:             'decimals',
  MembershipVotingCreated:           'membership',
  MembershipRevocationVotingCreated: 'membershipRevocation',
  ThemeVotingCreated:                'theme',
  StatementVotingCreated:            'statement',
};

function getArgs(log: unknown): Record<string, unknown> {
  return ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
}

function formatDeadline(endTime: number): string {
  const diff = endTime - now.value;
  if (diff <= 0) return '';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

async function loadRows(): Promise<VotingRow[]> {
  const [created, finalized, ...typeLogs] = await Promise.all([
    getLogs('VotingCreated'),
    getLogs('VotingFinalized'),
    ...TYPE_EVENT_NAMES.map(ev => getLogs(ev).catch(() => [] as unknown[])),
  ]);

  const typeById          = new Map<string, VotingType>();
  const proposedValueById  = new Map<string, string>();
  TYPE_EVENT_NAMES.forEach((ev, i) => {
    for (const log of typeLogs[i]) {
      const a  = getArgs(log);
      const id = String(a.votingId ?? '');
      if (!id) continue;
      typeById.set(id, TYPE_KEY_MAP[ev]);

      let proposal = '';
      if (ev === 'NumericalValueVotingCreated' || ev === 'CategoricalValueVotingCreated') {
        proposal = String(a.value ?? '');
      } else if (ev === 'CategoryVotingCreated') {
        proposal = a.categoryName ? String(a.categoryName) : `#${String(a.category ?? '')}`;
      } else if (ev === 'DecimalsVotingCreated') {
        proposal = String(a.decimals ?? '');
      } else if (ev === 'MembershipVotingCreated' || ev === 'MembershipRevocationVotingCreated') {
        proposal = shortAddress(String(a.member ?? ''));
      } else if (ev === 'ThemeVotingCreated') {
        proposal = String(a.theme ?? '');
      } else if (ev === 'StatementVotingCreated') {
        proposal = String(a.statement ?? '');
      }
      if (proposal) proposedValueById.set(id, proposal);
    }
  });

  const finalizedMap = new Map<string, boolean>();
  for (const log of finalized) {
    const a = getArgs(log);
    const id = String(a.votingId ?? '');
    if (id) finalizedMap.set(id, Boolean(a.success));
  }

  return created
    .map(log => {
      const a = getArgs(log);
      const id = String(a.votingId ?? '');
      return {
        id,
        author:           String(a.author ?? ''),
        startTime:        Number(a.startTime ?? 0),
        endTime:          Number(a.endTime ?? 0),
        typeKey:          typeById.get(id) ?? 'theme' as VotingType,
        finalized:        finalizedMap.has(id),
        finalizedSuccess: finalizedMap.get(id),
        proposedValue:    proposedValueById.get(id),
      };
    })
    .filter(v => v.id !== '');
}

async function loadVoteCounts(filtered: VotingRow[]): Promise<void> {
  for (const v of filtered) {
    readContract<{ forVotes: bigint; againstVotes: bigint }>('getVotingResults', [BigInt(v.id)])
      .then(res => {
        voteCounts.value.set(v.id, res);
        voteCounts.value = new Map(voteCounts.value);
      })
      .catch(() => {});

    if (!v.finalized && v.endTime > now.value && currentAddress.value) {
      readContract<boolean>('hasVoted', [BigInt(v.id), currentAddress.value])
        .then(voted => {
          hasVotedMap.value.set(v.id, voted);
          hasVotedMap.value = new Map(hasVotedMap.value);
        })
        .catch(() => {});
    }
  }
}

async function refresh(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  try {
    const newRows = await loadRows();
    rows.value        = newRows;
    voteCounts.value  = new Map();
    hasVotedMap.value = new Map();
    isOffline.value   = false;
    loadVoteCounts(newRows);
  } catch {
    isOffline.value = true;
  } finally {
    loading.value = false;
  }
}

const filteredRows = computed(() => {
  return rows.value
    .filter(v => {
      const active = !v.finalized && v.endTime > now.value;
      return tab.value === 'active' ? active : !active;
    })
    .sort((a, b) => b.endTime - a.endTime);
});

function rowClass(v: VotingRow): string {
  const expired = v.endTime <= now.value;
  const state = v.finalized ? 'finalized' : (expired ? 'expired' : 'active');
  return `voting-row voting-row--${state}`;
}

async function onExecute(v: VotingRow, quorum: string, approval: string): Promise<void> {
  const q = BigInt(parseInt(quorum || '0',  10));
  const a = BigInt(parseInt(approval || '50', 10));
  try {
    const hash = await writeContract('executeVoting', [BigInt(v.id), q, a]);
    await waitTx(hash);
    await refresh();
  } catch { /* error surfaced in sub-component */ }
}

function openCreate(): void {
  createVotingPrefill.value = null;
  navigate('create-voting');
}

onMounted(async () => {
  // Subscribe to events in the background — don't block the initial data load
  Promise.all([
    watchEvent('VotingCreated'),
    watchEvent('VotingFinalized'),
    watchEvent('VoteCasted'),
  ]).catch(() => {});

  await refresh();

  countdownTick = setInterval(() => { now.value = Math.floor(Date.now() / 1000); }, 1000);

  unsubEvent = onEvent((eventName) => {
    if (!['VotingCreated', 'VotingFinalized', 'VoteCasted'].includes(eventName)) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { debounceTimer = null; refresh(); }, 500);
  });
});

onUnmounted(async () => {
  if (countdownTick) clearInterval(countdownTick);
  if (debounceTimer)  clearTimeout(debounceTimer);
  if (unsubEvent)     unsubEvent();
  await Promise.all([
    unwatchEvent('VotingCreated'),
    unwatchEvent('VotingFinalized'),
    unwatchEvent('VoteCasted'),
  ]).catch(() => {});
});
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
