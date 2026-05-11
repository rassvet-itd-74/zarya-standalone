import './styles/index.scss';
import { initI18n, t, changeLang, currentLang } from './i18n';
import logoRound from './assets/images/logo_round.png';

declare global {
  interface Window {
    electronAPI: {
      hasKey(): Promise<boolean>;
      createKey(password: string): Promise<string>;
      unlockKey(password: string): Promise<string>;
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

function showWallet(address: string) {
  const el = document.getElementById('address');
  if (el) el.textContent = address;
  show('wallet-view');
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

// --- Theme ---
const savedTheme = (localStorage.getItem('theme') ?? 'light') as 'light' | 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeCheckbox.checked = savedTheme === 'dark';

themeCheckbox.addEventListener('change', () => {
  const theme = themeCheckbox.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

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

  langToggle.textContent = currentLang() === 'ru' ? 'EN' : 'RU';
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
    showWallet(address);
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
    showWallet(address);
  } catch (e: unknown) {
    unlockError.textContent = e instanceof Error ? e.message : String(e);
  } finally {
    unlockBtn.disabled = false;
    unlockBtn.textContent = t('unlock.unlockBtn');
  }
});

// --- Lang toggle ---
langToggle.addEventListener('click', async () => {
  const next = currentLang() === 'ru' ? 'en' : 'ru';
  await changeLang(next);
  applyTranslations();
});

// --- Init ---
(async () => {
  await initI18n();
  applyTranslations();
  appLogo.src = logoRound;
  const exists = await window.electronAPI.hasKey();
  show(exists ? 'unlock-view' : 'setup-view');
  if (exists) unlockPassword.focus();
  else createPassword.focus();
})();
