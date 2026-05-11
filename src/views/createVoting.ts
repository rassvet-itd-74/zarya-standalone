import { t } from '../i18n';
import { show } from '../utils';
import { currentAddress, isOffline } from '../state';

// ---- Voting types ----
type VotingType =
  | 'numericalValue'
  | 'categoricalValue'
  | 'category'
  | 'decimals'
  | 'membership'
  | 'membershipRevocation'
  | 'theme'
  | 'statement';

// Which voting types need an organ picker?
const NEEDS_ORGAN: VotingType[] = [
  'numericalValue', 'categoricalValue', 'category', 'decimals', 'membership', 'membershipRevocation',
];
// Which types need x/y matrix coordinates?
const NEEDS_XY: VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'theme', 'statement'];
const NEEDS_Y:  VotingType[] = ['numericalValue', 'categoricalValue', 'category', 'decimals', 'statement'];

// Organ type enum values supported by the contract
const ORGAN_TYPES: Array<{ value: number; labelKey: string }> = [
  { value: 0, labelKey: '0' },
  { value: 1, labelKey: '1' },
  { value: 2, labelKey: '2' },
  { value: 3, labelKey: '3' },
  { value: 4, labelKey: '4' },
  { value: 5, labelKey: '5' },
  { value: 6, labelKey: '6' },
  { value: 7, labelKey: '7' },
];
// Region enum values — 0 = federal, others = region codes
const ORGAN_REGIONS: Array<{ value: number; labelKey: string }> = [
  { value: 0,  labelKey: '0'  },
  { value: 74, labelKey: '74' },
];

// ---- State ----
let selectedType: VotingType | null = null;
let resolvedOrgan: `0x${string}` | null = null;
// Pre-fill context from matrix cell-detail
let prefillX: bigint | null = null;
let prefillY: bigint | null = null;
let prefillIsCategorical: boolean | null = null;
// Where to go back to
let backTarget: (() => void) | null = null;

// ---- DOM refs ----
const cvBackBtn          = document.getElementById('cv-back-btn')              as HTMLButtonElement;
const cvTypeList         = document.getElementById('cv-type-list')             as HTMLElement;
const cvStepOrgan        = document.getElementById('cv-step-organ')            as HTMLElement;
const cvOrganTypeSel     = document.getElementById('cv-organ-type-sel')        as HTMLSelectElement;
const cvOrganRegionSel   = document.getElementById('cv-organ-region-sel')      as HTMLSelectElement;
const cvOrganNumber      = document.getElementById('cv-organ-number')          as HTMLInputElement;
const cvOrganResolveBtn  = document.getElementById('cv-organ-resolve-btn')     as HTMLButtonElement;
const cvOrganResolved    = document.getElementById('cv-organ-resolved')        as HTMLElement;
const cvStepFields       = document.getElementById('cv-step-fields')           as HTMLElement;
const cvFieldIsCat       = document.getElementById('cv-field-is-categorical')  as HTMLElement;
const cvIsCat            = document.getElementById('cv-is-categorical')        as HTMLInputElement;
const cvIsCatLabel       = document.getElementById('cv-is-categorical-label')  as HTMLElement;
const cvFieldX           = document.getElementById('cv-field-x')               as HTMLElement;
const cvX                = document.getElementById('cv-x')                     as HTMLInputElement;
const cvFieldY           = document.getElementById('cv-field-y')               as HTMLElement;
const cvY                = document.getElementById('cv-y')                     as HTMLInputElement;
const cvFieldValue       = document.getElementById('cv-field-value')           as HTMLElement;
const cvValue            = document.getElementById('cv-value')                 as HTMLInputElement;
const cvFieldValueAuthor = document.getElementById('cv-field-value-author')    as HTMLElement;
const cvValueAuthor      = document.getElementById('cv-value-author')          as HTMLInputElement;
const cvFieldCategory    = document.getElementById('cv-field-category')        as HTMLElement;
const cvCategory         = document.getElementById('cv-category')              as HTMLInputElement;
const cvFieldCategoryName = document.getElementById('cv-field-category-name') as HTMLElement;
const cvCategoryName     = document.getElementById('cv-category-name')         as HTMLInputElement;
const cvFieldDecimals    = document.getElementById('cv-field-decimals')        as HTMLElement;
const cvDecimals         = document.getElementById('cv-decimals')              as HTMLInputElement;
const cvFieldMember      = document.getElementById('cv-field-member')          as HTMLElement;
const cvMember           = document.getElementById('cv-member')                as HTMLInputElement;
const cvFieldTheme       = document.getElementById('cv-field-theme')           as HTMLElement;
const cvTheme            = document.getElementById('cv-theme')                 as HTMLInputElement;
const cvFieldStatement   = document.getElementById('cv-field-statement')       as HTMLElement;
const cvStatement        = document.getElementById('cv-statement')             as HTMLInputElement;
const cvDuration         = document.getElementById('cv-duration')              as HTMLInputElement;
const cvDurationUnit     = document.getElementById('cv-duration-unit')         as HTMLSelectElement;
const cvActions          = document.getElementById('cv-actions')               as HTMLElement;
const cvSubmitBtn        = document.getElementById('cv-submit-btn')            as HTMLButtonElement;
const cvStatus           = document.getElementById('cv-status')                as HTMLElement;

// ---- Translations ----
export function applyCreateVotingTranslations(): void {
  (document.getElementById('cv-title') as HTMLElement).textContent = t('createVoting.title');
  cvBackBtn.textContent          = t('createVoting.back');
  (document.getElementById('cv-type-label')          as HTMLElement).textContent = t('createVoting.typeLabel');
  (document.getElementById('cv-organ-label')         as HTMLElement).textContent = t('createVoting.organLabel');
  (document.getElementById('cv-label-is-categorical') as HTMLElement).textContent = t('createVoting.isCategoricalLabel');
  (document.getElementById('cv-label-x')             as HTMLElement).textContent = t('createVoting.labelX');
  (document.getElementById('cv-label-y')             as HTMLElement).textContent = t('createVoting.labelY');
  (document.getElementById('cv-label-value')         as HTMLElement).textContent = t('createVoting.labelValue');
  (document.getElementById('cv-label-value-author')  as HTMLElement).textContent = t('createVoting.labelValueAuthor');
  (document.getElementById('cv-label-category')      as HTMLElement).textContent = t('createVoting.labelCategory');
  (document.getElementById('cv-label-category-name') as HTMLElement).textContent = t('createVoting.labelCategoryName');
  (document.getElementById('cv-label-decimals')      as HTMLElement).textContent = t('createVoting.labelDecimals');
  (document.getElementById('cv-label-member')        as HTMLElement).textContent = t('createVoting.labelMember');
  (document.getElementById('cv-label-theme')         as HTMLElement).textContent = t('createVoting.labelTheme');
  (document.getElementById('cv-label-statement')     as HTMLElement).textContent = t('createVoting.labelStatement');
  (document.getElementById('cv-label-duration')      as HTMLElement).textContent = t('createVoting.labelDuration');
  // Translate unit selector options
  (document.getElementById('cv-unit-minutes') as HTMLOptionElement).textContent = t('createVoting.durationUnits.minutes');
  (document.getElementById('cv-unit-hours')   as HTMLOptionElement).textContent = t('createVoting.durationUnits.hours');
  (document.getElementById('cv-unit-days')    as HTMLOptionElement).textContent = t('createVoting.durationUnits.days');
  (document.getElementById('cv-unit-months')  as HTMLOptionElement).textContent = t('createVoting.durationUnits.months');
  cvOrganResolveBtn.textContent  = t('createVoting.organResolveBtn');
  cvSubmitBtn.textContent        = t('createVoting.submitBtn');
  updateIsCatLabel();
  // Re-render type buttons if already drawn
  if (cvTypeList.children.length > 0) renderTypeButtons();
}

function updateIsCatLabel(): void {
  cvIsCatLabel.textContent = cvIsCat.checked
    ? t('createVoting.isCategoricalSy')
    : t('createVoting.isCategoricalSx');
}

// ---- Type buttons ----
function renderTypeButtons(): void {
  const types: VotingType[] = [
    'numericalValue', 'categoricalValue', 'category', 'decimals',
    'membership', 'membershipRevocation', 'theme', 'statement',
  ];
  cvTypeList.innerHTML = types.map(type =>
    `<button class="cv-type-btn${selectedType === type ? ' cv-type-btn--active' : ''}" data-type="${type}">
       ${t(`createVoting.types.${type}`)}
     </button>`,
  ).join('');
  cvTypeList.querySelectorAll<HTMLButtonElement>('.cv-type-btn').forEach(btn => {
    btn.addEventListener('click', () => selectType(btn.dataset.type as VotingType));
  });
}

// ---- Organ dropdown init ----
function initOrganSelects(): void {
  cvOrganTypeSel.innerHTML = ORGAN_TYPES.map(ot =>
    `<option value="${ot.value}">${t(`createVoting.organTypes.${ot.labelKey}`)}</option>`,
  ).join('');
  cvOrganRegionSel.innerHTML = ORGAN_REGIONS.map(r =>
    `<option value="${r.value}">${t(`createVoting.regions.${r.labelKey}`)}</option>`,
  ).join('');
  // Default to region 74
  cvOrganRegionSel.value = '74';
}

// ---- Select type ----
function selectType(type: VotingType): void {
  selectedType  = type;
  resolvedOrgan = null;
  cvOrganResolved.textContent = '';
  cvStatus.textContent = '';

  renderTypeButtons();

  const needsOrgan = NEEDS_ORGAN.includes(type);
  cvStepOrgan.style.display  = needsOrgan ? '' : 'none';
  cvStepFields.style.display = '';
  cvActions.style.display    = '';

  // Show/hide fields based on type
  const show_ = (el: HTMLElement, visible: boolean) => { el.style.display = visible ? '' : 'none'; };

  show_(cvFieldIsCat,       type === 'theme' || type === 'statement');
  show_(cvFieldX,           NEEDS_XY.includes(type));
  show_(cvFieldY,           NEEDS_Y.includes(type));
  show_(cvFieldValue,       type === 'numericalValue' || type === 'categoricalValue');
  show_(cvFieldValueAuthor, type === 'numericalValue' || type === 'categoricalValue');
  show_(cvFieldCategory,    type === 'categoricalValue' || type === 'category');
  show_(cvFieldCategoryName, type === 'category');
  show_(cvFieldDecimals,    type === 'decimals');
  show_(cvFieldMember,      type === 'membership' || type === 'membershipRevocation');
  show_(cvFieldTheme,       type === 'theme');
  show_(cvFieldStatement,   type === 'statement');

  // Pre-fill x/y from context
  if (prefillX !== null && NEEDS_XY.includes(type)) {
    cvX.value = prefillX.toString();
  }
  if (prefillY !== null && NEEDS_Y.includes(type)) {
    cvY.value = prefillY.toString();
  }
  if (prefillIsCategorical !== null && (type === 'theme' || type === 'statement')) {
    cvIsCat.checked = prefillIsCategorical;
    updateIsCatLabel();
  }

  // Default value author to current address
  if ((type === 'numericalValue' || type === 'categoricalValue') && currentAddress) {
    cvValueAuthor.value = currentAddress;
  }
}

// ---- Organ resolve ----
async function resolveOrgan(): Promise<void> {
  const orgType = parseInt(cvOrganTypeSel.value, 10);
  const region  = parseInt(cvOrganRegionSel.value, 10);
  const number  = parseInt(cvOrganNumber.value, 10) || 0;
  cvOrganResolveBtn.disabled  = true;
  cvOrganResolved.textContent = '…';
  try {
    const [organ, identifier] = await Promise.all([
      window.zaryaAPI.read('getPartyOrgan',           [orgType, region, number]) as Promise<`0x${string}`>,
      window.zaryaAPI.read('getPartyOrganIdentifier', [orgType, region, number]) as Promise<string>,
    ]);
    resolvedOrgan = organ;
    cvOrganResolved.textContent = `${t('createVoting.organResolved')}: ${identifier} (${organ.slice(0, 10)}…)`;
    cvOrganResolved.style.color = '';
  } catch (e) {
    resolvedOrgan = null;
    cvOrganResolved.textContent = t('createVoting.organUnresolved');
    cvOrganResolved.style.color = '#c0392b';
  } finally {
    cvOrganResolveBtn.disabled = false;
  }
}

// ---- Validation helpers ----
const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());

// ---- Duration → seconds ----
function durationToSeconds(): bigint {
  const amount = Math.max(1, parseInt(cvDuration.value, 10) || 1);
  const unit   = cvDurationUnit.value as 'minutes' | 'hours' | 'days' | 'months';
  const multipliers: Record<typeof unit, number> = {
    minutes: 60,
    hours:   3600,
    days:    86400,
    months:  2592000, // 30 days
  };
  return BigInt(amount * multipliers[unit]);
}

// ---- Build tx args ----
function buildTxArgs(): { fn: string; args: unknown[] } | string {
  if (!selectedType) return t('createVoting.typeLabel');
  const durationSec = durationToSeconds();
  const isCat = cvIsCat.checked;
  const x = BigInt(parseInt(cvX.value, 10) || 0);
  const y = BigInt(parseInt(cvY.value, 10) || 0);

  if (NEEDS_ORGAN.includes(selectedType) && !resolvedOrgan) return t('createVoting.errorNoOrgan');

  switch (selectedType) {
    case 'numericalValue': {
      const val    = BigInt(parseInt(cvValue.value, 10) || 0);
      const author = cvValueAuthor.value.trim();
      if (!isAddress(author)) return t('createVoting.errorInvalidAddress');
      return { fn: 'createNumericalValueVoting', args: [resolvedOrgan!, x, y, val, author, durationSec] };
    }
    case 'categoricalValue': {
      const val    = BigInt(parseInt(cvCategory.value, 10) || 0);
      const author = cvValueAuthor.value.trim();
      if (!isAddress(author)) return t('createVoting.errorInvalidAddress');
      return { fn: 'createCategoricalValueVoting', args: [resolvedOrgan!, x, y, val, author, durationSec] };
    }
    case 'category': {
      const cat  = BigInt(parseInt(cvCategory.value, 10) || 0);
      const name = cvCategoryName.value.trim();
      if (!name) return t('createVoting.errorNoText');
      return { fn: 'createCategoryVoting', args: [resolvedOrgan!, x, y, cat, name, durationSec] };
    }
    case 'decimals': {
      const dec = parseInt(cvDecimals.value, 10) || 0;
      return { fn: 'createDecimalsVoting', args: [resolvedOrgan!, x, y, dec, durationSec] };
    }
    case 'membership': {
      const member = cvMember.value.trim();
      if (!isAddress(member)) return t('createVoting.errorInvalidAddress');
      return { fn: 'createMembershipVoting', args: [resolvedOrgan!, member, durationSec] };
    }
    case 'membershipRevocation': {
      const member = cvMember.value.trim();
      if (!isAddress(member)) return t('createVoting.errorInvalidAddress');
      return { fn: 'createMembershipRevocationVoting', args: [resolvedOrgan!, member, durationSec] };
    }
    case 'theme': {
      const theme = cvTheme.value.trim();
      if (!theme) return t('createVoting.errorNoText');
      return { fn: 'createThemeVoting', args: [isCat, x, theme, durationSec] };
    }
    case 'statement': {
      const stmt = cvStatement.value.trim();
      if (!stmt) return t('createVoting.errorNoText');
      return { fn: 'createStatementVoting', args: [isCat, x, y, stmt, durationSec] };
    }
  }
}

// ---- Submit ----
async function submitVoting(): Promise<void> {
  cvStatus.textContent = '';
  if (isOffline) { cvStatus.textContent = t('offline.readOnly'); return; }
  const tx = buildTxArgs();
  if (typeof tx === 'string') { cvStatus.textContent = tx; return; }

  cvSubmitBtn.disabled = true;
  cvStatus.textContent = t('createVoting.sending');
  try {
    const hash = await window.zaryaAPI.write(tx.fn, tx.args);
    cvStatus.textContent = t('createVoting.waiting');
    const receipt = await window.zaryaAPI.waitTx(hash);
    const nextId  = await window.zaryaAPI.read('nextVotingId', []) as bigint;
    const votingId = (nextId - 1n).toString();
    void receipt;
    cvStatus.textContent = t('createVoting.done').replace('{id}', votingId);
  } catch (e) {
    cvStatus.textContent = e instanceof Error ? e.message : t('votings.txError');
  } finally {
    cvSubmitBtn.disabled = false;
  }
}

// ---- Public API ----
export interface CreateVotingContext {
  isCategorical?: boolean;
  x?: bigint;
  y?: bigint;
  preselect?: VotingType;
  back: () => void;
}

export function showCreateVoting(ctx: CreateVotingContext): void {
  prefillX             = ctx.x    ?? null;
  prefillY             = ctx.y    ?? null;
  prefillIsCategorical = ctx.isCategorical ?? null;
  backTarget           = ctx.back;
  selectedType         = null;
  resolvedOrgan        = null;
  cvStatus.textContent = '';

  // Reset UI
  cvStepOrgan.style.display  = 'none';
  cvStepFields.style.display = 'none';
  cvActions.style.display    = 'none';
  cvOrganResolved.textContent = '';
  cvIsCat.checked = prefillIsCategorical ?? false;
  updateIsCatLabel();
  if (prefillX !== null) cvX.value = prefillX.toString();
  if (prefillY !== null) cvY.value = prefillY.toString();
  cvDuration.value     = '7';
  cvDurationUnit.value = 'days';

  initOrganSelects();
  renderTypeButtons();
  if (ctx.preselect) selectType(ctx.preselect);

  show('create-voting-view');
}

// ---- Event handlers ----
cvBackBtn.addEventListener('click', () => { if (backTarget) backTarget(); });
cvIsCat.addEventListener('change', () => updateIsCatLabel());
cvOrganResolveBtn.addEventListener('click', () => resolveOrgan());
cvOrganNumber.addEventListener('keydown', e => { if (e.key === 'Enter') resolveOrgan(); });
cvSubmitBtn.addEventListener('click', () => submitVoting());
