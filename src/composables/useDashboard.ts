import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { getChain, getLogs } from '../services/zaryaService';

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

export function useDashboard() {
  const { isOffline, navigate } = useAppState();

  const votingsCount = ref('...');

  async function load(): Promise<void> {
    votingsCount.value = '...';

    const [chainResult, votingsResult] = await Promise.allSettled([
      getChain(),
      countActiveVotings(),
    ]);

    isOffline.value    = chainResult.status !== 'fulfilled';
    votingsCount.value = votingsResult.status === 'fulfilled'
      ? String(votingsResult.value)
      : '?';
  }

  onMounted(load);

  return { votingsCount, isOffline, navigate };
}
