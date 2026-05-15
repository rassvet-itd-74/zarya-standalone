<script setup lang="ts">
import { useI18n } from '../composables/useI18n';
import { useVotingFieldsForm } from '../composables/useVotingFieldsForm';
import type { VotingType, VotingPayload, CreateVotingPrefill } from '../types/voting';

const props = defineProps<{
  type:       VotingType;
  prefill:    CreateVotingPrefill | null;
  organ:      `0x${string}` | null;
  submitting: boolean;
}>();
const emit = defineEmits<{ submit: [payload: VotingPayload] }>();

const { t } = useI18n();
const {
  currentAddress,
  isCategorical, fieldX, fieldY, fieldValue, fieldAuthor, fieldCategory,
  fieldCatName, fieldDecimals, fieldMember, fieldTheme, fieldStatement,
  durationAmt, durationUnit,
  showIsCat, showX, showY, showValue, showAuthor, showCategory,
  showCatName, showDecimals, showMember, showTheme, showStatement,
  authorIsMe, isCatLabel,
  setAuthorToMe, onSubmit,
} = useVotingFieldsForm(props, payload => emit('submit', payload));
</script>

<template>
  <div class="cv-step">
    <div v-if="showIsCat" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.isCategoricalLabel') }}</label>
      <label class="toggle">
        <input v-model="isCategorical" type="checkbox" class="toggle__input" />
        <span class="toggle__track"></span>
        <span class="toggle__label">{{ isCatLabel }}</span>
      </label>
    </div>

    <div v-if="showX" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelX') }}</label>
      <input v-model="fieldX" class="field__input field__input--sm" type="number" min="0" />
    </div>

    <div v-if="showY" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelY') }}</label>
      <input v-model="fieldY" class="field__input field__input--sm" type="number" min="0" />
    </div>

    <div v-if="showValue" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelValue') }}</label>
      <input v-model="fieldValue" class="field__input field__input--sm" type="number" min="0" />
    </div>

    <div v-if="showAuthor" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelValueAuthor') }}</label>
      <input v-model="fieldAuthor" class="field__input" type="text" spellcheck="false" autocomplete="off" />
      <button v-if="currentAddress" class="btn btn--sm btn--outline" type="button" @click="setAuthorToMe">{{ t('createVoting.me') }}</button>
    </div>

    <div v-if="showCategory" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelCategory') }}</label>
      <input v-model="fieldCategory" class="field__input field__input--sm" type="number" min="0" />
    </div>

    <div v-if="showCatName" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelCategoryName') }}</label>
      <input v-model="fieldCatName" class="field__input" type="text" spellcheck="false" />
    </div>

    <div v-if="showDecimals" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelDecimals') }}</label>
      <input v-model="fieldDecimals" class="field__input field__input--sm" type="number" min="0" max="18" />
    </div>

    <div v-if="showMember" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelMember') }}</label>
      <input v-model="fieldMember" class="field__input" type="text" spellcheck="false" autocomplete="off" />
    </div>

    <div v-if="showTheme" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelTheme') }}</label>
      <input v-model="fieldTheme" class="field__input" type="text" spellcheck="false" />
    </div>

    <div v-if="showStatement" class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelStatement') }}</label>
      <input v-model="fieldStatement" class="field__input" type="text" spellcheck="false" />
    </div>

    <div class="cv-field-row">
      <label class="cv-field-row__label">{{ t('createVoting.labelDuration') }}</label>
      <input v-model="durationAmt" class="field__input field__input--sm" type="number" min="1" />
      <select v-model="durationUnit" class="field__input field__input--sm">
        <option value="minutes">{{ t('createVoting.durationUnits.minutes') }}</option>
        <option value="hours">{{ t('createVoting.durationUnits.hours') }}</option>
        <option value="days">{{ t('createVoting.durationUnits.days') }}</option>
        <option value="months">{{ t('createVoting.durationUnits.months') }}</option>
      </select>
    </div>

    <div class="cv-step cv-step--actions">
      <button class="btn" :disabled="submitting || !organ" @click="onSubmit">
        {{ organ ? t('createVoting.submitBtn') : t('createVoting.errorNoOrgan') }}
      </button>
    </div>
  </div>
</template>
