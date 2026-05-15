import { ref, computed, watch } from 'vue';
import { useI18n } from './useI18n';
import { useAppState } from './useAppState';
import type { VotingType, VotingPayload, CreateVotingPrefill } from '../types/voting';

const NEEDS_XY: VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'theme', 'statement'];
const NEEDS_Y:  VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'statement'];

interface Props {
  type:       VotingType;
  prefill:    CreateVotingPrefill | null;
  organ:      `0x${string}` | null;
  submitting: boolean;
}

export function useVotingFieldsForm(props: Props, onSubmitEmit: (payload: VotingPayload) => void) {
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

  const isCatLabel = computed(() =>
    isCategorical.value ? t('createVoting.isCategoricalSy') : t('createVoting.isCategoricalSx'),
  );

  function setAuthorToMe(): void {
    if (currentAddress.value) fieldAuthor.value = currentAddress.value;
  }

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
    onSubmitEmit({
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

  return {
    currentAddress,
    isCategorical, fieldX, fieldY, fieldValue, fieldAuthor, fieldCategory,
    fieldCatName, fieldDecimals, fieldMember, fieldTheme, fieldStatement,
    durationAmt, durationUnit,
    showIsCat, showX, showY, showValue, showAuthor, showCategory,
    showCatName, showDecimals, showMember, showTheme, showStatement,
    authorIsMe, isCatLabel,
    setAuthorToMe, onSubmit,
  };
}
