<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useOrganPicker, ORGAN_TYPES, ORGAN_REGIONS } from '../composables/useOrganPicker';

const props = defineProps<{ modelValue: `0x${string}` | null }>();
const emit  = defineEmits<{ 'update:modelValue': [organ: `0x${string}` | null] }>();

const { t } = useI18n();
const {
  organTypeVal, organRegionVal, organNumber,
  needsRegion, needsNumber,
  statusKey, statusSuffix, resolving,
  resolve,
} = useOrganPicker(organ => emit('update:modelValue', organ));
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
