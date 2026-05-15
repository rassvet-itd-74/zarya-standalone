<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import type { VotingType } from '../types/voting';

defineProps<{ selected: VotingType | null }>();
const emit = defineEmits<{ select: [type: VotingType] }>();

const { t } = useI18n();

const ALL_TYPES: VotingType[] = [
  'numericalValue', 'categoricalValue', 'category', 'decimals',
  'membership', 'membershipRevocation', 'theme', 'statement',
];
</script>

<template>
  <div class="cv-type-list">
    <button
      v-for="type in ALL_TYPES"
      :key="type"
      class="cv-type-btn"
      :class="{ 'cv-type-btn--active': selected === type }"
      @click="emit('select', type)"
    >{{ t(`createVoting.types.${type}`) }}</button>
  </div>
</template>
