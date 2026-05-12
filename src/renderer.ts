import './styles/index.scss';
import { initI18n, t, changeLang, currentLang } from './i18n';
import logoRound from './assets/images/logo_round.png';
import { currentAddress, setCurrentAddress } from './state';
import { show } from './utils';
import { showDashboard } from './views/dashboard';
import { showVotings, applyVotingsTranslations } from './views/votings';
import { showMatrix, applyMatrixTranslations } from './views/matrix';
import { showCreateVoting, applyCreateVotingTranslations } from './views/createVoting';

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
      balance(address: string): Promise<string>;
      checkOrgan(organCode: string, address: string): Promise<boolean>;
      onEvent(cb: (eventName: string, logs: unknown[]) => void): () => void;
    };
    tagsAPI: {
      read(): Promise<Array<{ code: string; organ?: string }>>;
      write(tags: Array<{ code: string; organ?: string }>): Promise<void>;
      exportTags(): Promise<boolean>;
      importTags(): Promise<Array<{ code: string; organ?: string }> | null>;
      resolve(code: string): Promise<string | null>;
    };
  }
}

const DEFAULT_CONTRACT_ADDRESS = '0x141EB27110329C82De3C95045C96f6eBF15fDc4b';
const DEFAULT_CHAIN_ID = 11155111;

// ---- DOM refs ----
const createBtn            = document.getElementById('create-btn')        as HTMLButtonElement;
const createPassword       = document.getElementById('create-password')   as HTMLInputElement;
const createConfirm        = document.getElementById('create-confirm')    as HTMLInputElement;
const createError          = document.getElementById('create-error')      as HTMLElement;
const unlockBtn            = document.getElementById('unlock-btn')        as HTMLButtonElement;
const unlockPassword       = document.getElementById('unlock-password')   as HTMLInputElement;
const unlockError          = document.getElementById('unlock-error')      as HTMLElement;
const langToggle           = document.getElementById('lang-toggle')       as HTMLButtonElement;
const appLogo              = document.getElementById('app-logo')          as HTMLImageElement;
const themeCheckbox        = document.getElementById('theme-checkbox')    as HTMLInputElement;
const exportBtn            = document.getElementById('export-btn')        as HTMLButtonElement;
const exportStatus         = document.getElementById('export-status')     as HTMLElement;
const importBtn            = document.getElementById('import-btn')        as HTMLButtonElement;
const importStatus         = document.getElementById('import-status')     as HTMLElement;
const settingsOpenBtn      = document.getElementById('settings-open-btn') as HTMLButtonElement;
const settingsTestBtn      = document.getElementById('settings-test-btn') as HTMLButtonElement;
const settingsSaveBtn      = document.getElementById('settings-save-btn') as HTMLButtonElement;
const settingsBackBtn      = document.getElementById('settings-back-btn') as HTMLButtonElement;
const settingsStatus       = document.getElementById('settings-status')   as HTMLElement;
const contractAddressInput = document.getElementById('contract-address')  as HTMLInputElement;
const chainIdInput         = document.getElementById('chain-id')          as HTMLInputElement;

// ---- Theme ----
const savedTheme = (localStorage.getItem('theme') ?? 'light') as 'light' | 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeCheckbox.checked = savedTheme === 'dark';
themeCheckbox.addEventListener('change', () => {
  const theme = themeCheckbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

function applyRandomTitle(): void {
  document.title = t(`titles.${Math.floor(Math.random() * 3)}`);
}

function applyTranslations(): void {
  (document.querySelector('#setup-view .setup-form__title')       as HTMLElement).textContent = t('setup.title');
  (document.querySelector('#setup-view .setup-form__description') as HTMLElement).textContent = t('setup.description');
  (document.querySelector('label[for="create-password"]')         as HTMLElement).textContent = t('setup.passwordLabel');
  (document.querySelector('label[for="create-confirm"]')          as HTMLElement).textContent = t('setup.confirmLabel');
  createBtn.textContent = t('setup.generateBtn');

  (document.querySelector('#unlock-view .unlock-form__title') as HTMLElement).textContent = t('unlock.title');
  (document.querySelector('label[for="unlock-password"]')     as HTMLElement).textContent = t('unlock.passwordLabel');
  unlockBtn.textContent = t('unlock.unlockBtn');

  (document.querySelector('#wallet-view .wallet__title') as HTMLElement).textContent = t('wallet.title');
  (document.querySelector('.wallet__label')              as HTMLElement).textContent = t('wallet.addressLabel');
  exportBtn.textContent     = t('wallet.exportBtn');
  importBtn.textContent     = t('importBtn');
  settingsOpenBtn.textContent = t('settings.openBtn');

  (document.querySelector('#settings-view .settings-form__title') as HTMLElement).textContent = t('settings.title');
  (document.querySelector('label[for="contract-address"]')        as HTMLElement).textContent = t('settings.contractAddressLabel');
  (document.querySelector('label[for="chain-id"]')                as HTMLElement).textContent = t('settings.chainIdLabel');
  settingsTestBtn.textContent = t('settings.testBtn');
  settingsSaveBtn.textContent = t('settings.saveBtn');
  settingsBackBtn.textContent = t('settings.backBtn');

  (document.getElementById('dash-title')          as HTMLElement).textContent = t('dashboard.title');
  (document.getElementById('dash-address-label')  as HTMLElement).textContent = t('dashboard.addressLabel');
  (document.getElementById('dash-balance-label')  as HTMLElement).textContent = t('dashboard.balanceLabel');
  (document.getElementById('dash-organs-label')   as HTMLElement).textContent = t('dashboard.organsLabel');
  (document.getElementById('dash-votings-label')  as HTMLElement).textContent = t('dashboard.activeVotingsLabel');
  (document.getElementById('dash-votings-btn')    as HTMLElement).textContent = t('dashboard.votingsBtn');
  (document.getElementById('dash-matrix-btn')     as HTMLElement).textContent = t('dashboard.matrixBtn');
  (document.getElementById('dash-settings-btn')   as HTMLElement).textContent = t('dashboard.settingsBtn');
  (document.getElementById('dash-wallet-btn')     as HTMLElement).textContent = t('dashboard.walletBtn');
  (document.getElementById('wallet-back-btn')     as HTMLElement).textContent = t('dashboard.backBtn');
  (document.getElementById('dash-organs-export')  as HTMLElement).title       = t('organs.exportTitle');
  (document.getElementById('dash-organs-import')  as HTMLElement).title       = t('organs.importTitle');
  (document.getElementById('organ-code-input') as HTMLInputElement).placeholder = t('organs.codePlaceholder');

  applyVotingsTranslations();
  applyMatrixTranslations();
  applyCreateVotingTranslations();

  (document.getElementById('rpc-banner') as HTMLElement).textContent = t('offline.banner');

  langToggle.textContent = currentLang() === 'ru' ? 'EN' : 'RU';
  (document.getElementById('app-city')       as HTMLElement).textContent = t('city');
  (document.getElementById('app-dev-credit') as HTMLElement).textContent = t('devCredit');
}

// ---- After unlock ----
async function afterUnlock(address: string): Promise<void> {
  setCurrentAddress(address);
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

// ---- Setup view ----
createBtn.addEventListener('click', async () => {
  createError.textContent = '';
  const pw = createPassword.value;
  const confirm = createConfirm.value;
  if (!pw) { createError.textContent = t('setup.errorRequired'); return; }
  if (pw !== confirm) { createError.textContent = t('setup.errorMismatch'); return; }
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

// ---- Unlock view ----
unlockPassword.addEventListener('keydown', e => { if (e.key === 'Enter') unlockBtn.click(); });

unlockBtn.addEventListener('click', async () => {
  unlockError.textContent = '';
  const pw = unlockPassword.value;
  if (!pw) { unlockError.textContent = t('unlock.errorRequired'); return; }
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

// ---- Wallet ----
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

(document.getElementById('wallet-back-btn') as HTMLButtonElement).addEventListener('click', async () => {
  if (currentAddress) {
    const config = await window.configAPI.read();
    if (config) { await showDashboard(currentAddress); return; }
    show('settings-view');
    return;
  }
  const exists = await window.electronAPI.hasKey();
  show(exists ? 'unlock-view' : 'setup-view');
});

// ---- Settings ----
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
    if (config) { await showDashboard(currentAddress); return; }
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
      if (currentAddress) await showDashboard(currentAddress);
      else show('wallet-view');
    }, 800);
  } catch (e: unknown) {
    settingsStatus.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    settingsSaveBtn.disabled = false;
  }
});

// ---- Lang toggle ----
langToggle.addEventListener('click', async () => {
  const next = currentLang() === 'ru' ? 'en' : 'ru';
  await changeLang(next);
  applyTranslations();
  applyRandomTitle();
});

// ---- Dashboard navigation ----
(document.getElementById('dash-settings-btn') as HTMLButtonElement).addEventListener('click', async () => {
  settingsStatus.textContent = '';
  const config = await window.configAPI.read();
  contractAddressInput.value = config?.contractAddress ?? DEFAULT_CONTRACT_ADDRESS;
  chainIdInput.value = String(config?.chainId ?? DEFAULT_CHAIN_ID);
  show('settings-view');
});
(document.getElementById('dash-wallet-btn')  as HTMLButtonElement).addEventListener('click', () => show('wallet-view'));
(document.getElementById('dash-votings-btn') as HTMLButtonElement).addEventListener('click', () => showVotings());
(document.getElementById('dash-matrix-btn')  as HTMLButtonElement).addEventListener('click', () => showMatrix());

// ---- Init ----
(async () => {
  await initI18n();
  applyTranslations();
  applyRandomTitle();
  appLogo.src = logoRound;
  contractAddressInput.value = DEFAULT_CONTRACT_ADDRESS;
  chainIdInput.value = String(DEFAULT_CHAIN_ID);
  const exists = await window.electronAPI.hasKey();
  show(exists ? 'unlock-view' : 'setup-view');
  if (exists) unlockPassword.focus();
  else createPassword.focus();
})();
