import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAppState } from './useAppState';
import { getLogs, watchEvent, unwatchEvent, readContract, writeContract, waitTx, onEvent } from '../services/zaryaService';
import type { VotingRow, VotingTab, VotingType } from '../types/voting';

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

function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

export function useVotings() {
  const { currentAddress, isOffline, navigate, createVotingPrefill } = useAppState();

  const tab          = ref<VotingTab>('active');
  const rows         = ref<VotingRow[]>([]);
  const loading      = ref(false);
  const castTargetId = ref<string | null>(null);
  const voteCounts   = ref<Map<string, { forVotes: bigint; againstVotes: bigint }>>(new Map());
  const hasVotedMap  = ref<Map<string, boolean>>(new Map());
  const now          = ref(Math.floor(Date.now() / 1000));

  let countdownTick: ReturnType<typeof setInterval> | null = null;
  let debounceTimer: ReturnType<typeof setTimeout>  | null = null;
  let unsubEvent:    (() => void)                   | null = null;

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

  async function loadRows(): Promise<VotingRow[]> {
    const [created, finalized, ...typeLogs] = await Promise.all([
      getLogs('VotingCreated'),
      getLogs('VotingFinalized'),
      ...TYPE_EVENT_NAMES.map(ev => getLogs(ev).catch(() => [] as unknown[])),
    ]);

    const typeById         = new Map<string, VotingType>();
    const proposedValueById = new Map<string, string>();
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

  const filteredRows = computed(() =>
    rows.value
      .filter(v => {
        const active = !v.finalized && v.endTime > now.value;
        return tab.value === 'active' ? active : !active;
      })
      .sort((a, b) => b.endTime - a.endTime),
  );

  function rowClass(v: VotingRow): string {
    const expired = v.endTime <= now.value;
    const state = v.finalized ? 'finalized' : (expired ? 'expired' : 'active');
    return `voting-row voting-row--${state}`;
  }

  async function onExecute(v: VotingRow, quorum: string, approval: string): Promise<void> {
    const q = BigInt(parseInt(quorum   || '0',  10));
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

  return {
    tab, rows, loading, castTargetId, voteCounts, hasVotedMap, now,
    filteredRows, navigate,
    formatDeadline, shortAddress, formatDate, rowClass,
    refresh, openCreate, onExecute,
  };
}
