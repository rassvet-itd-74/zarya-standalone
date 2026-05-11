import './styles/index.scss';
import { initI18n, t, changeLang, currentLang } from './i18n';
import logoRound from './assets/images/logo_round.png';

declare global {
  interface Window {
    electronAPI: {
      hasKey(): Promise<boolean>;
      createKey(password: string): Promise<string>;
      unlockKey(password: string): Promise<string>;
      exportKey(): Promise<boolean>;
      importKey(): Promise<boolean>;
    };
    configAPI: {
      read(): Promise<{ contractAddress: string; chainId: number } | null>;
      write(config: { contractAddress: string; chainId: number }): Promise<void>;
      test(): Promise<number>;
    };
    zaryaAPI: {
      read(fn: string, args: unknown[]): Promise<unknown>;
      write(fn: string, args: unknown[]): Promise<`0x${string}`>;
      waitTx(hash: `0x${string}`): Promise<unknown>;
      getLogs(eventName: string, fromBlock?: bigint): Promise<unknown[]>;
      watch(eventName: string): Promise<void>;
      unwatch(eventName: string): Promise<void>;
      chain(): Promise<{ blockNumber: string; chainId: number }>;
      membership(address: string): Promise<string[]>;
      onEvent(cb: (eventName: string, logs: unknown[]) => void): () => void;
    };
  }
}

function show(id: string) {
  document.querySelectorAll<HTMLElement>('.view').forEach((el) => {
    el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = '';
}

// Address of the currently unlocked key — set after unlock/create
let currentAddress = '';

// Predefined deployment defaults
const DEFAULT_CONTRACT_ADDRESS = '0x75BbACe4A6720636622F1a344B13c5DC193D06a4';
const DEFAULT_CHAIN_ID = 111555111;

async function afterUnlock(address: string) {
  currentAddress = address;
  // Keep wallet-view address in sync for the export flow
  const addrEl = document.getElementById('address');
  if (addrEl) addrEl.textContent = address;

  const config = await window.configAPI.read();
  if (!config) {
    contractAddressInput.value = DEFAULT_CONTRACT_ADDRESS;
    chainIdInput.value = String(DEFAULT_CHAIN_ID);
    settingsStatus.textContent = '';
    show('settings-view');
    return;
  }
  await showDashboard(address);
}

async function countActiveVotings(): Promise<number> {
  const [created, finalized] = await Promise.all([
    window.zaryaAPI.getLogs('VotingCreated'),
    window.zaryaAPI.getLogs('VotingFinalized'),
  ]);
  const finalizedIds = new Set(
    finalized.map(log => ((log as Record<string, unknown>).args as Record<string, unknown>)?.votingId?.toString()),
  );
  const now = Math.floor(Date.now() / 1000);
  return created.filter(log => {
    const args = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
    return !finalizedIds.has(args.votingId?.toString()) && Number(args.endTime ?? 0) > now;
  }).length;
}

async function showDashboard(address: string) {
  // Render skeleton immediately
  (document.getElementById('dashboard-address') as HTMLElement).textContent = address;
  (document.getElementById('dashboard-chain-id') as HTMLElement).textContent = '';
  (document.getElementById('dashboard-block') as HTMLElement).textContent = '';
  (document.getElementById('dashboard-organs') as HTMLElement).innerHTML =
    `<span class="dashboard__organ-none">${t('dashboard.loading')}</span>`;
  (document.getElementById('dashboard-votings-count') as HTMLElement).textContent = '…';
  show('dashboard-view');

  // Load data in parallel; failures are tolerated
  const [chainResult, organsResult, votingsResult] = await Promise.allSettled([
    window.zaryaAPI.chain(),
    window.zaryaAPI.membership(address),
    countActiveVotings(),
  ]);

  if (chainResult.status === 'fulfilled') {
    (document.getElementById('dashboard-chain-id') as HTMLElement).textContent =
      `Chain ${chainResult.value.chainId}`;
    (document.getElementById('dashboard-block') as HTMLElement).textContent =
      `${t('dashboard.block')} #${chainResult.value.blockNumber}`;
  } else {
    (document.getElementById('dashboard-chain-id') as HTMLElement).textContent =
      t('dashboard.offline');
  }

  const organsEl = document.getElementById('dashboard-organs') as HTMLElement;
  if (organsResult.status === 'fulfilled' && organsResult.value.length > 0) {
    organsEl.innerHTML = organsResult.value
      .map(id => `<span class="dashboard__organ-tag">${id}</span>`)
      .join('');
  } else {
    organsEl.innerHTML = `<span class="dashboard__organ-none">${t('dashboard.noOrgans')}</span>`;
  }

  (document.getElementById('dashboard-votings-count') as HTMLElement).textContent =
    votingsResult.status === 'fulfilled' ? String(votingsResult.value) : '?';
}

// --- DOM refs ---
const createBtn      = document.getElementById('create-btn')        as HTMLButtonElement;
const createPassword = document.getElementById('create-password')   as HTMLInputElement;
const createConfirm  = document.getElementById('create-confirm')    as HTMLInputElement;
const createError    = document.getElementById('create-error')      as HTMLElement;
const unlockBtn      = document.getElementById('unlock-btn')        as HTMLButtonElement;
const unlockPassword = document.getElementById('unlock-password')   as HTMLInputElement;
const unlockError    = document.getElementById('unlock-error')      as HTMLElement;
const langToggle     = document.getElementById('lang-toggle')       as HTMLButtonElement;
const appLogo        = document.getElementById('app-logo')          as HTMLImageElement;
const themeCheckbox  = document.getElementById('theme-checkbox')    as HTMLInputElement;
const exportBtn      = document.getElementById('export-btn')        as HTMLButtonElement;
const exportStatus   = document.getElementById('export-status')     as HTMLElement;
const importBtn      = document.getElementById('import-btn')        as HTMLButtonElement;
const importStatus   = document.getElementById('import-status')     as HTMLElement;
const settingsOpenBtn  = document.getElementById('settings-open-btn')  as HTMLButtonElement;
const settingsTestBtn  = document.getElementById('settings-test-btn')  as HTMLButtonElement;
const settingsSaveBtn  = document.getElementById('settings-save-btn')  as HTMLButtonElement;
const settingsBackBtn  = document.getElementById('settings-back-btn')  as HTMLButtonElement;
const settingsStatus   = document.getElementById('settings-status')    as HTMLElement;
const contractAddressInput = document.getElementById('contract-address') as HTMLInputElement;
const chainIdInput         = document.getElementById('chain-id')         as HTMLInputElement;
const dashVotingsBtn  = document.getElementById('dash-votings-btn')  as HTMLButtonElement;
const dashMatrixBtn   = document.getElementById('dash-matrix-btn')   as HTMLButtonElement;
const dashSettingsBtn = document.getElementById('dash-settings-btn') as HTMLButtonElement;
const dashWalletBtn   = document.getElementById('dash-wallet-btn')   as HTMLButtonElement;
const walletBackBtn   = document.getElementById('wallet-back-btn')   as HTMLButtonElement;

// --- Theme ---
const savedTheme = (localStorage.getItem('theme') ?? 'light') as 'light' | 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeCheckbox.checked = savedTheme === 'dark';

themeCheckbox.addEventListener('change', () => {
  const theme = themeCheckbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

function applyRandomTitle() {
  const idx = Math.floor(Math.random() * 3);
  document.title = t(`titles.${idx}`);
}

// --- Translations ---
function applyTranslations() {
  (document.querySelector('#setup-view .setup-form__title')       as HTMLElement).textContent = t('setup.title');
  (document.querySelector('#setup-view .setup-form__description') as HTMLElement).textContent = t('setup.description');
  (document.querySelector('label[for="create-password"]')         as HTMLElement).textContent = t('setup.passwordLabel');
  (document.querySelector('label[for="create-confirm"]')          as HTMLElement).textContent = t('setup.confirmLabel');
  createBtn.textContent = t('setup.generateBtn');

  (document.querySelector('#unlock-view .unlock-form__title')     as HTMLElement).textContent = t('unlock.title');
  (document.querySelector('label[for="unlock-password"]')         as HTMLElement).textContent = t('unlock.passwordLabel');
  unlockBtn.textContent = t('unlock.unlockBtn');

  (document.querySelector('#wallet-view .wallet__title')          as HTMLElement).textContent = t('wallet.title');
  (document.querySelector('.wallet__label')                       as HTMLElement).textContent = t('wallet.addressLabel');
  exportBtn.textContent = t('wallet.exportBtn');
  importBtn.textContent = t('importBtn');
  settingsOpenBtn.textContent = t('settings.openBtn');

  (document.querySelector('#settings-view .settings-form__title') as HTMLElement).textContent = t('settings.title');
  (document.querySelector('label[for="contract-address"]')        as HTMLElement).textContent = t('settings.contractAddressLabel');
  (document.querySelector('label[for="chain-id"]')                as HTMLElement).textContent = t('settings.chainIdLabel');
  settingsTestBtn.textContent = t('settings.testBtn');
  settingsSaveBtn.textContent = t('settings.saveBtn');
  settingsBackBtn.textContent = t('settings.backBtn');

  (document.getElementById('dash-title')          as HTMLElement).textContent = t('dashboard.title');
  (document.getElementById('dash-address-label')  as HTMLElement).textContent = t('dashboard.addressLabel');
  (document.getElementById('dash-organs-label')   as HTMLElement).textContent = t('dashboard.organsLabel');
  (document.getElementById('dash-votings-label')  as HTMLElement).textContent = t('dashboard.activeVotingsLabel');
  dashVotingsBtn.textContent  = t('dashboard.votingsBtn');
  dashMatrixBtn.textContent   = t('dashboard.matrixBtn');
  dashSettingsBtn.textContent = t('dashboard.settingsBtn');
  dashWalletBtn.textContent   = t('dashboard.walletBtn');
  walletBackBtn.textContent   = t('dashboard.backBtn');

  langToggle.textContent = currentLang() === 'ru' ? 'EN' : 'RU';
  (document.getElementById('app-city') as HTMLElement).textContent = t('city');
  (document.getElementById('app-dev-credit') as HTMLElement).textContent = t('devCredit');
}

// --- Setup view ---
createBtn.addEventListener('click', async () => {
  createError.textContent = '';
  const pw = createPassword.value;
  const confirm = createConfirm.value;
  if (!pw) {
    createError.textContent = t('setup.errorRequired');
    return;
  }
  if (pw !== confirm) {
    createError.textContent = t('setup.errorMismatch');
    return;
  }
  createBtn.disabled = true;
  createBtn.textContent = t('setup.generating');
  try {
    const address = await window.electronAPI.createKey(pw);
    await afterUnlock(address);
  } catch (e: unknown) {
    createError.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = t('setup.generateBtn');
  }
});

// --- Unlock view ---
unlockPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') unlockBtn.click();
});

unlockBtn.addEventListener('click', async () => {
  unlockError.textContent = '';
  const pw = unlockPassword.value;
  if (!pw) {
    unlockError.textContent = t('unlock.errorRequired');
    return;
  }
  unlockBtn.disabled = true;
  unlockBtn.textContent = t('unlock.unlocking');
  try {
    const address = await window.electronAPI.unlockKey(pw);
    await afterUnlock(address);
  } catch (e: unknown) {
    unlockError.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = t('unlock.unlockBtn');
  }
});

// --- Export ---
exportBtn.addEventListener('click', async () => {
  exportStatus.textContent = '';
  exportBtn.disabled = true;
  try {
    const saved = await window.electronAPI.exportKey();
    exportStatus.textContent = saved ? t('wallet.exportDone') : t('wallet.exportCancelled');
  } catch (e: unknown) {
    exportStatus.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    exportBtn.disabled = false;
  }
});

// --- Import ---
importBtn.addEventListener('click', async () => {
  importStatus.textContent = '';
  importBtn.disabled = true;
  try {
    const loaded = await window.electronAPI.importKey();
    importStatus.textContent = loaded ? t('importDone') : t('importCancelled');
  } catch (e: unknown) {
    importStatus.textContent = e instanceof Error ? e.message : t('importError');
  } finally {
    importBtn.disabled = false;
  }
});

// --- Settings ---
settingsOpenBtn.addEventListener('click', async () => {
  settingsStatus.textContent = '';
  const config = await window.configAPI.read();
  contractAddressInput.value = config?.contractAddress ?? DEFAULT_CONTRACT_ADDRESS;
  chainIdInput.value = String(config?.chainId ?? DEFAULT_CHAIN_ID);
  show('settings-view');
});

settingsBackBtn.addEventListener('click', async () => {
  if (currentAddress) {
    const config = await window.configAPI.read();
    if (config) {
      await showDashboard(currentAddress);
      return;
    }
  }
  show('wallet-view');
});

settingsTestBtn.addEventListener('click', async () => {
  settingsStatus.textContent = t('settings.testing');
  settingsTestBtn.disabled = true;
  try {
    const chainId = await window.configAPI.test();
    chainIdInput.value = String(chainId);
    settingsStatus.textContent = t('settings.testSuccess');
  } catch (e: unknown) {
    settingsStatus.textContent = e instanceof Error ? e.message : t('settings.testFail');
  } finally {
    settingsTestBtn.disabled = false;
  }
});

settingsSaveBtn.addEventListener('click', async () => {
  const contractAddress = contractAddressInput.value.trim();
  const chainId = parseInt(chainIdInput.value, 10);
  if (!contractAddress || !/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    settingsStatus.textContent = t('settings.errorInvalidAddress');
    return;
  }
  if (!chainId || chainId < 1) {
    settingsStatus.textContent = t('settings.errorInvalidChainId');
    return;
  }
  settingsSaveBtn.disabled = true;
  try {
    await window.configAPI.write({ contractAddress, chainId });
    settingsStatus.textContent = t('settings.saved');
    setTimeout(async () => {
      if (currentAddress) {
        await showDashboard(currentAddress);
      } else {
        show('wallet-view');
      }
    }, 800);
  } catch (e: unknown) {
    settingsStatus.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    settingsSaveBtn.disabled = false;
  }
});

// --- Lang toggle ---
langToggle.addEventListener('click', async () => {
  const next = currentLang() === 'ru' ? 'en' : 'ru';
  await changeLang(next);
  applyTranslations();
  applyRandomTitle();
});

// --- Dashboard navigation ---
dashSettingsBtn.addEventListener('click', () => {
  settingsStatus.textContent = '';
  show('settings-view');
});

dashWalletBtn.addEventListener('click', () => {
  show('wallet-view');
});

dashVotingsBtn.addEventListener('click', () => {
  // Phase 4 — placeholder
});

dashMatrixBtn.addEventListener('click', () => {
  // Phase 5 — placeholder
});

walletBackBtn.addEventListener('click', async () => {
  if (currentAddress) {
    const config = await window.configAPI.read();
    if (config) {
      await showDashboard(currentAddress);
      return;
    }
  }
  // No config: stay on wallet-view (user needs to configure first)
});

// --- Init ---
(async () => {
  await initI18n();
  applyTranslations();
  applyRandomTitle();
  appLogo.src = logoRound;

  // Pre-fill settings with defaults so they're visible from the start
  contractAddressInput.value = DEFAULT_CONTRACT_ADDRESS;
  chainIdInput.value = String(DEFAULT_CHAIN_ID);
  const exists = await window.electronAPI.hasKey();
  show(exists ? 'unlock-view' : 'setup-view');
  if (exists) unlockPassword.focus();
  else createPassword.focus();
})();
