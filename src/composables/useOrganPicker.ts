import { ref, computed } from 'vue';
import { readContract } from '../services/zaryaService';

export const ORGAN_TYPES   = [0, 1, 2, 3, 4, 5, 6, 7];
export const ORGAN_REGIONS = Array.from({ length: 98 }, (_, i) => i);

export function useOrganPicker(onUpdate: (organ: `0x${string}` | null) => void) {
  const organTypeVal   = ref(0);
  const organRegionVal = ref(74);
  const organNumber    = ref(0);

  // Types 0–1 (local) need region + number.
  // Types 2–4 (regional) need region only.
  // Types 5–7 (Chairperson, Central Council, Congress) need neither.
  const needsRegion = computed(() => organTypeVal.value <= 4);
  const needsNumber = computed(() => organTypeVal.value <= 1);

  const statusKey    = ref('');
  const statusSuffix = ref('');
  const resolving    = ref(false);

  async function resolve(): Promise<void> {
    resolving.value    = true;
    statusKey.value    = '';
    statusSuffix.value = '...';
    try {
      const regionArg = needsRegion.value ? organRegionVal.value : 0;
      const numberArg = needsNumber.value ? organNumber.value : 0;
      const [organ, identifier] = await Promise.all([
        readContract<`0x${string}`>('getPartyOrgan',           [organTypeVal.value, regionArg, numberArg]),
        readContract<string>       ('getPartyOrganIdentifier', [organTypeVal.value, regionArg, numberArg]),
      ]);
      onUpdate(organ);
      statusKey.value    = 'createVoting.organResolved';
      statusSuffix.value = `: ${identifier} (${organ.slice(0, 10)}...)`;
    } catch {
      onUpdate(null);
      statusKey.value    = 'createVoting.organUnresolved';
      statusSuffix.value = '';
    } finally {
      resolving.value = false;
    }
  }

  return {
    organTypeVal, organRegionVal, organNumber,
    needsRegion, needsNumber,
    statusKey, statusSuffix, resolving,
    resolve,
  };
}
