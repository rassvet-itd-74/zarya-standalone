<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { writeContract, waitTx } from '../services/zaryaService';
import VotingTypePicker from './VotingTypePicker.vue';
import OrganPicker from './OrganPicker.vue';
import VotingFieldsForm from './VotingFieldsForm.vue';
import type { VotingType, VotingPayload } from '../types/voting';

const NEEDS_ORGAN: VotingType[] = [
  'numericalValue', 'categoricalValue', 'category', 'decimals', 'membership', 'membershipRevocation',
];

const { t } = useI18n();
const { isOffline, navigate, createVotingPrefill } = useAppState();

const selectedType  = ref<VotingType | null>(null);
const resolvedOrgan = ref<`0x${string}` | null>(null);
const statusKey     = ref('');
const statusMsg     = ref('');
const statusArg     = ref('');
const submitting    = ref(false);

const showOrgan = computed(() =>
  selectedType.value !== null && NEEDS_ORGAN.includes(selectedType.value),
);

function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s.trim());
}

function buildTxArgs(p: VotingPayload): { fn: string; args: unknown[] } | string {
  if (NEEDS_ORGAN.includes(p.type) && !p.organ) return 'createVoting.errorNoOrgan';

  switch (p.type) {
    case 'numericalValue':
      if (!isAddress(p.valueAuthor)) return 'createVoting.errorInvalidAddress';
      return { fn: 'createNumericalValueVoting',   args: [p.organ!, p.x, p.y, p.value, p.valueAuthor, p.durationSeconds] };
    case 'categoricalValue':
      if (!isAddress(p.valueAuthor)) return 'createVoting.errorInvalidAddress';
      return { fn: 'createCategoricalValueVoting', args: [p.organ!, p.x, p.y, p.category, p.valueAuthor, p.durationSeconds] };
    case 'category':
      if (!p.categoryName) return 'createVoting.errorNoText';
      return { fn: 'createCategoryVoting',         args: [p.organ!, p.x, p.y, p.category, p.categoryName, p.durationSeconds] };
    case 'decimals':
      return { fn: 'createDecimalsVoting',         args: [p.organ!, p.x, p.y, p.decimals, p.durationSeconds] };
    case 'membership':
      if (!isAddress(p.member)) return 'createVoting.errorInvalidAddress';
      return { fn: 'createMembershipVoting',       args: [p.organ!, p.member, p.durationSeconds] };
    case 'membershipRevocation':
      if (!isAddress(p.member)) return 'createVoting.errorInvalidAddress';
      return { fn: 'createMembershipRevocationVoting', args: [p.organ!, p.member, p.durationSeconds] };
    case 'theme':
      if (!p.theme) return 'createVoting.errorNoText';
      return { fn: 'createThemeVoting',            args: [p.isCategorical, p.x, p.theme, p.durationSeconds] };
    case 'statement':
      if (!p.statement) return 'createVoting.errorNoText';
      return { fn: 'createStatementVoting',        args: [p.isCategorical, p.x, p.y, p.statement, p.durationSeconds] };
  }
}

async function onSubmit(payload: VotingPayload): Promise<void> {
  statusKey.value = ''; statusMsg.value = ''; statusArg.value = '';
  if (isOffline.value) { statusKey.value = 'offline.readOnly'; return; }
  const tx = buildTxArgs(payload);
  if (typeof tx === 'string') { statusKey.value = tx; return; }
  submitting.value = true;
  statusKey.value = 'createVoting.sending';
  try {
    const hash = await writeContract(tx.fn, tx.args);
    statusKey.value = 'createVoting.waiting';
    await waitTx(hash);
    statusKey.value = 'createVoting.done'; statusArg.value = '?';
  } catch (e: unknown) {
    if (e instanceof Error) { statusMsg.value = e.message; statusKey.value = ''; statusArg.value = ''; }
    else                    { statusKey.value = 'votings.txError'; statusMsg.value = ''; statusArg.value = ''; }
  } finally {
    submitting.value = false;
  }
}

function onTypeSelect(type: VotingType): void {
  selectedType.value  = type;
  resolvedOrgan.value = null;
  statusKey.value = ''; statusMsg.value = ''; statusArg.value = '';
}

function goBack(): void {
  const hadPrefill = createVotingPrefill.value !== null;
  createVotingPrefill.value = null;
  navigate(hadPrefill ? 'matrix' : 'votings');
}

onMounted(() => {
  const pf = createVotingPrefill.value;
  if (pf) selectedType.value = pf.isCategorical ? 'categoricalValue' : 'numericalValue';
});
</script>

<template>
  <div class="create-voting">
    <div class="create-voting__header">
      <button class="btn btn--ghost btn--sm" @click="goBack">{{ t('createVoting.back') }}</button>
      <h2 class="create-voting__title">{{ t('createVoting.title') }}</h2>
    </div>

    <div class="cv-step">
      <p class="cv-step__label">{{ t('createVoting.typeLabel') }}</p>
      <VotingTypePicker :selected="selectedType" @select="onTypeSelect" />
    </div>

    <template v-if="selectedType !== null">
      <OrganPicker v-if="showOrgan" v-model="resolvedOrgan" />

      <VotingFieldsForm
        :type="selectedType"
        :prefill="createVotingPrefill"
        :organ="resolvedOrgan"
        :submitting="submitting"
        @submit="onSubmit"
      />

      <p v-if="statusKey || statusMsg" class="cv-status">{{ statusKey ? t(statusKey).replace('{id}', statusArg) : statusMsg }}</p>
    </template>
  </div>
</template>
