<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '../composables/useI18n';
import { readContract } from '../services/zaryaService';

defineProps<{ modelValue: `0x${string}` | null }>();
const emit = defineEmits<{ 'update:modelValue': [organ: `0x${string}` | null] }>();

const { t } = useI18n();

const ORGAN_TYPES   = [0, 1, 2, 3, 4, 5, 6, 7];
const ORGAN_REGIONS = Array.from({ length: 98 }, (_, i) => i);

const organTypeVal   = ref(0);
const organRegionVal = ref(74);
const organNumber    = ref(0);

// Types 0–1 (local) need region + number.
// Types 2–4 (regional) need region only.
// Types 5–7 (Chairperson, Central Council, Congress) need neither.
const needsRegion = computed(() => organTypeVal.value <= 4);
const needsNumber = computed(() => organTypeVal.value <= 1);
const statusKey      = ref('');
const statusSuffix   = ref('');
const resolving      = ref(false);

async function resolve(): Promise<void> {
  resolving.value   = true;
  statusKey.value   = '';
  statusSuffix.value = '...';
  try {
    const regionArg = needsRegion.value ? organRegionVal.value : 0;
    const numberArg = needsNumber.value ? organNumber.value : 0;
    const [organ, identifier] = await Promise.all([
      readContract<`0x${string}`>('getPartyOrgan',           [organTypeVal.value, regionArg, numberArg]),
      readContract<string>       ('getPartyOrganIdentifier', [organTypeVal.value, regionArg, numberArg]),
    ]);
    emit('update:modelValue', organ);
    statusKey.value    = 'createVoting.organResolved';
    statusSuffix.value = `: ${identifier} (${organ.slice(0, 10)}...)`;
  } catch {
    emit('update:modelValue', null);
    statusKey.value    = 'createVoting.organUnresolved';
    statusSuffix.value = '';
  } finally {
    resolving.value = false;
  }
}
</script>

<template>
  <div class="cv-step cv-step--organ">
    <p class="cv-step__label">{{ t('createVoting.organLabel') }}</p>
    <div class="cv-organ-picker">
      <select v-model="organTypeVal" class="field__input field__input--sm">
        <option v-for="v in ORGAN_TYPES" :key="v" :value="v">{{ t(`createVoting.organTypes.${v}`) }}</option>
      </select>
      <select v-if="needsRegion" v-model="organRegionVal" class="field__input field__input--sm">
        <option v-for="v in ORGAN_REGIONS" :key="v" :value="v">{{ t(`createVoting.regions.${v}`) }}</option>
      </select>
      <input v-if="needsNumber" v-model.number="organNumber" class="field__input field__input--sm" type="number" min="0" />
      <button class="btn btn--sm btn--outline" :disabled="resolving" @click="resolve">
        {{ t('createVoting.organResolveBtn') }}
      </button>
    </div>
    <p v-if="statusKey || statusSuffix" class="cv-organ-status" :class="{ 'cv-organ-status--ok': modelValue }">
      {{ statusKey ? t(statusKey) + statusSuffix : statusSuffix }}
    </p>
  </div>
</template>
