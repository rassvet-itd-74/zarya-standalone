<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { readTags } from '../services/tagsService';
import { checkOrganMembership, writeContract, waitTx } from '../services/zaryaService';
import type { OrganTag } from '../types/organ';

const props = defineProps<{ votingId: string }>();
const emit  = defineEmits<{ done: []; cancel: [] }>();

const { t } = useI18n();
const { currentAddress, isOffline } = useAppState();

const support      = ref(true);
const organValue   = ref('');
const organs       = ref<OrganTag[]>([]);
const statusKey    = ref('');
const statusMsg    = ref('');
const confirming   = ref(false);

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

async function onConfirm(): Promise<void> {
  if (isOffline.value)    { statusKey.value = 'offline.readOnly'; statusMsg.value = ''; return; }
  if (!organValue.value) { statusKey.value = 'votings.selectOrgan'; statusMsg.value = ''; return; }
  confirming.value = true;
  statusKey.value = 'votings.sendingTx'; statusMsg.value = '';
  try {
    const hash = await writeContract('castVote', [
      BigInt(props.votingId),
      support.value,
      organValue.value as `0x${string}`,
    ]);
    statusKey.value = 'votings.waitingTx';
    await waitTx(hash);
    statusKey.value = 'votings.txDone'; statusMsg.value = '';
    emit('done');
  } catch (e: unknown) {
    if (e instanceof Error) { statusMsg.value = e.message; statusKey.value = ''; }
    else                    { statusKey.value = 'votings.txError'; statusMsg.value = ''; }
  } finally {
    confirming.value = false;
  }
}
</script>

<template>
  <div class="cast-vote-panel">
    <p class="cast-vote-panel__label">{{ t('votings.castVote') }} #{{ votingId }}</p>

    <div class="cast-vote-panel__support">
      <button
        class="btn btn--sm"
        :class="{ 'cast-vote-panel__btn--active': support }"
        @click="support = true"
      >{{ t('votings.for') }}</button>
      <button
        class="btn btn--sm btn--outline"
        :class="{ 'cast-vote-panel__btn--active': !support }"
        @click="support = false"
      >{{ t('votings.against') }}</button>
    </div>

    <select v-model="organValue" class="field__input field__input--sm">
      <option value="" disabled>{{ t('votings.selectOrgan') }}</option>
      <option v-for="tg in organs" :key="tg.organ" :value="tg.organ">{{ tg.code }}</option>
      <option v-if="organs.length === 0" value="" disabled>{{ t('votings.noMemberOrgans') }}</option>
    </select>

    <div class="cast-vote-panel__actions">
      <button class="btn btn--sm" :disabled="confirming" @click="onConfirm">{{ t('votings.confirm') }}</button>
      <button class="btn btn--ghost btn--sm" @click="emit('cancel')">{{ t('votings.cancel') }}</button>
    </div>

    <p class="cast-vote-panel__status">{{ statusKey ? t(statusKey) : statusMsg }}</p>
  </div>
</template>
