<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import type { VotingType, VotingPayload, CreateVotingPrefill } from '../types/voting';

const NEEDS_XY: VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'theme', 'statement'];
const NEEDS_Y:  VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'statement'];

const props = defineProps<{
  type:       VotingType;
  prefill:    CreateVotingPrefill | null;
  organ:      `0x${string}` | null;
  submitting: boolean;
}>();
const emit = defineEmits<{ submit: [payload: VotingPayload] }>();

const { t } = useI18n();
const { currentAddress } = useAppState();

const isCategorical  = ref(false);
const fieldX         = ref('');
const fieldY         = ref('');
const fieldValue     = ref('');
const fieldAuthor    = ref('');
const fieldCategory  = ref('');
const fieldCatName   = ref('');
const fieldDecimals  = ref('0');
const fieldMember    = ref('');
const fieldTheme     = ref('');
const fieldStatement = ref('');
const durationAmt    = ref('7');
const durationUnit   = ref<'minutes' | 'hours' | 'days' | 'months'>('days');

const showIsCat     = computed(() => props.type === 'theme' || props.type === 'statement');
const showX         = computed(() => NEEDS_XY.includes(props.type));
const showY         = computed(() => NEEDS_Y.includes(props.type));
const showValue     = computed(() => props.type === 'numericalValue' || props.type === 'categoricalValue');
const showAuthor    = computed(() => props.type === 'numericalValue' || props.type === 'categoricalValue');
const showCategory  = computed(() => props.type === 'categoricalValue' || props.type === 'category');
const showCatName   = computed(() => props.type === 'category');
const showDecimals  = computed(() => props.type === 'decimals');
const showMember    = computed(() => props.type === 'membership' || props.type === 'membershipRevocation');
const showTheme     = computed(() => props.type === 'theme');
const showStatement = computed(() => props.type === 'statement');

const authorIsMe = computed(() =>
  !!currentAddress.value &&
  fieldAuthor.value.toLowerCase() === currentAddress.value.toLowerCase(),
);

function setAuthorToMe(): void {
  if (currentAddress.value) fieldAuthor.value = currentAddress.value;
}

const isCatLabel = computed(() =>
  isCategorical.value ? t('createVoting.isCategoricalSy') : t('createVoting.isCategoricalSx'),
);

watch(() => props.type, (type) => {
  if (props.prefill) {
    if (NEEDS_XY.includes(type)) fieldX.value = props.prefill.x.toString();
    if (NEEDS_Y.includes(type))  fieldY.value = props.prefill.y.toString();
    if (type === 'theme' || type === 'statement') isCategorical.value = props.prefill.isCategorical;
  }
  if ((type === 'numericalValue' || type === 'categoricalValue') && currentAddress.value) {
    fieldAuthor.value = currentAddress.value;
  }
}, { immediate: true });

function durationToSeconds(): bigint {
  const amount = Math.max(1, parseInt(durationAmt.value, 10) || 1);
  const mults = { minutes: 60, hours: 3600, days: 86400, months: 2592000 };
  return BigInt(amount) * BigInt(mults[durationUnit.value]);
}

function onSubmit(): void {
  emit('submit', {
    type:            props.type,
    organ:           props.organ,
    x:               BigInt(parseInt(fieldX.value, 10) || 0),
    y:               BigInt(parseInt(fieldY.value, 10) || 0),
    isCategorical:   isCategorical.value,
    value:           BigInt(parseInt(fieldValue.value, 10) || 0),
    valueAuthor:     fieldAuthor.value.trim(),
    category:        BigInt(parseInt(fieldCategory.value, 10) || 0),
    categoryName:    fieldCatName.value.trim(),
    decimals:        parseInt(fieldDecimals.value, 10) || 0,
    member:          fieldMember.value.trim(),
    theme:           fieldTheme.value.trim(),
    statement:       fieldStatement.value.trim(),
    durationSeconds: durationToSeconds(),
  });
}
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
