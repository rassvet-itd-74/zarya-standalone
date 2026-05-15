<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useCastVote } from '../composables/useCastVote';

const props = defineProps<{ votingId: string }>();
const emit  = defineEmits<{ done: []; cancel: [] }>();

const { t } = useI18n();
const { support, organValue, organs, statusKey, statusMsg, confirming, confirm } =
  useCastVote(props.votingId, () => emit('done'));
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
      <button class="btn btn--sm" :disabled="confirming" @click="confirm">{{ t('votings.confirm') }}</button>
      <button class="btn btn--ghost btn--sm" @click="emit('cancel')">{{ t('votings.cancel') }}</button>
    </div>

    <p class="cast-vote-panel__status">{{ statusKey ? t(statusKey) : statusMsg }}</p>
  </div>
</template>
