import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { readTags } from '../services/tagsService';
import { checkOrganMembership, writeContract, waitTx } from '../services/zaryaService';
import type { OrganTag } from '../types/organ';

export function useCastVote(votingId: string, onDone: () => void) {
  const { currentAddress, isOffline } = useAppState();

  const support    = ref(true);
  const organValue = ref('');
  const organs     = ref<OrganTag[]>([]);
  const statusKey  = ref('');
  const statusMsg  = ref('');
  const confirming = ref(false);

  onMounted(async () => {
    const tags = await readTags();
    organs.value = tags.filter(tg => !!tg.organ);

    if (currentAddress.value) {
      for (const tg of organs.value) {
        const ok = await checkOrganMembership(tg.organ!, currentAddress.value).catch(() => false);
        if (ok) { organValue.value = tg.organ!; break; }
      }
    }
  });

  async function confirm(): Promise<void> {
    if (isOffline.value)   { statusKey.value = 'offline.readOnly';    statusMsg.value = ''; return; }
    if (!organValue.value) { statusKey.value = 'votings.selectOrgan'; statusMsg.value = ''; return; }
    confirming.value = true;
    statusKey.value  = 'votings.sendingTx';
    statusMsg.value  = '';
    try {
      const hash = await writeContract('castVote', [
        BigInt(votingId),
        support.value,
        organValue.value as `0x${string}`,
      ]);
      statusKey.value = 'votings.waitingTx';
      await waitTx(hash);
      statusKey.value = 'votings.txDone';
      statusMsg.value = '';
      onDone();
    } catch (e: unknown) {
      if (e instanceof Error) { statusMsg.value = e.message; statusKey.value = ''; }
      else                    { statusKey.value = 'votings.txError'; statusMsg.value = ''; }
    } finally {
      confirming.value = false;
    }
  }

  return { support, organValue, organs, statusKey, statusMsg, confirming, confirm };
}
