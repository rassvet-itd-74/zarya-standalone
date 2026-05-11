import { t } from '../i18n';
import { currentAddress } from '../state';
import { show } from '../utils';

// ---- Organ tag DOM refs ----
const organCodeInput      = document.getElementById('organ-code-input')   as HTMLInputElement;
const dashOrganAddBtn     = document.getElementById('dash-organ-add-btn') as HTMLButtonElement;
const dashOrgansExportBtn = document.getElementById('dash-organs-export') as HTMLButtonElement;
const dashOrgansImportBtn = document.getElementById('dash-organs-import') as HTMLButtonElement;

// ---- Helpers ----
async function countActiveVotings(): Promise<number> {
  const [created, finalized] = await Promise.all([
    window.zaryaAPI.getLogs('VotingCreated'),
    window.zaryaAPI.getLogs('VotingFinalized'),
  ]);
  const finalizedIds = new Set(
    finalized.map(log =>
      ((log as Record<string, unknown>).args as Record<string, unknown>)?.votingId?.toString(),
    ),
  );
  const now = Math.floor(Date.now() / 1000);
  return created.filter(log => {
    const args = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
    return !finalizedIds.has(args.votingId?.toString()) && Number(args.endTime ?? 0) > now;
  }).length;
}

// ---- Organ tags ----
async function renderOrganTags(): Promise<void> {
  const organsEl = document.getElementById('dashboard-organs') as HTMLElement;
  if (!organsEl) return;

  const tags = await window.tagsAPI.read();

  if (tags.length === 0) {
    organsEl.innerHTML = `<span class="dashboard__organ-none">${t('organs.noTags')}</span>`;
    return;
  }

  organsEl.innerHTML = tags
    .map((tag, i) => {
      const resolved = !!tag.organ;
      return (
        `<span class="dashboard__organ-tag ${resolved ? 'dashboard__organ-tag--pending' : 'dashboard__organ-tag--unresolved'}" data-index="${i}" title="${tag.organ ?? t('organs.unresolved')}">` +
        `<span class="dashboard__organ-dot"></span>` +
        `<span>${tag.code}</span>` +
        `<button class="dashboard__organ-remove" data-index="${i}" aria-label="${t('organs.remove')}">×</button>` +
        `</span>`
      );
    })
    .join('');

  organsEl.querySelectorAll<HTMLButtonElement>('.dashboard__organ-remove').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index!);
      const current = await window.tagsAPI.read();
      await window.tagsAPI.write(current.filter((_, i) => i !== idx));
      renderOrganTags();
    });
  });

  if (currentAddress) {
    tags.forEach((tag, i) => {
      if (!tag.organ) return;
      window.zaryaAPI.checkOrgan(tag.organ, currentAddress).then(isMember => {
        const tagEl = organsEl.querySelector<HTMLElement>(`[data-index="${i}"]`);
        if (!tagEl) return;
        tagEl.classList.remove('dashboard__organ-tag--pending');
        tagEl.classList.add(isMember ? 'dashboard__organ-tag--member' : 'dashboard__organ-tag--unknown');
      });
    });
  }
}

// ---- Dashboard view ----
export async function showDashboard(address: string): Promise<void> {
  (document.getElementById('dashboard-address')       as HTMLElement).textContent = address;
  (document.getElementById('dashboard-balance')        as HTMLElement).textContent = '…';
  (document.getElementById('dashboard-chain-id')      as HTMLElement).textContent = '';
  (document.getElementById('dashboard-block')         as HTMLElement).textContent = '';
  (document.getElementById('dashboard-organs')        as HTMLElement).innerHTML   = '';
  (document.getElementById('dashboard-votings-count') as HTMLElement).textContent = '…';
  show('dashboard-view');

  const [chainResult, votingsResult, balanceResult] = await Promise.allSettled([
    window.zaryaAPI.chain(),
    countActiveVotings(),
    window.zaryaAPI.balance(address),
  ]);

  if (balanceResult.status === 'fulfilled') {
    (document.getElementById('dashboard-balance') as HTMLElement).textContent =
      `${balanceResult.value} ETH`;
  } else {
    (document.getElementById('dashboard-balance') as HTMLElement).textContent = '?';
  }

  if (chainResult.status === 'fulfilled') {
    (document.getElementById('dashboard-chain-id') as HTMLElement).textContent =
      `Chain ${chainResult.value.chainId}`;
    (document.getElementById('dashboard-block') as HTMLElement).textContent =
      `${t('dashboard.block')} #${chainResult.value.blockNumber}`;
  } else {
    (document.getElementById('dashboard-chain-id') as HTMLElement).textContent =
      t('dashboard.offline');
  }

  (document.getElementById('dashboard-votings-count') as HTMLElement).textContent =
    votingsResult.status === 'fulfilled' ? String(votingsResult.value) : '?';

  renderOrganTags();
}

// ---- Organ tag event handlers ----
dashOrganAddBtn.addEventListener('click', async () => {
  const code = organCodeInput.value.trim();
  if (!code) return;
  const tags = await window.tagsAPI.read();
  if (tags.some(tag => tag.code.toUpperCase() === code.toUpperCase())) return;

  tags.push({ code });
  await window.tagsAPI.write(tags);
  organCodeInput.value = '';
  renderOrganTags();

  window.tagsAPI.resolve(code).then(async organ => {
    if (!organ) return;
    const current = await window.tagsAPI.read();
    const target = current.find(tg => tg.code.toUpperCase() === code.toUpperCase());
    if (target) {
      target.organ = organ;
      await window.tagsAPI.write(current);
      renderOrganTags();
    }
  });
});

organCodeInput.addEventListener('keydown', e => { if (e.key === 'Enter') dashOrganAddBtn.click(); });

dashOrgansExportBtn.addEventListener('click', () => window.tagsAPI.exportTags());

dashOrgansImportBtn.addEventListener('click', async () => {
  const imported = await window.tagsAPI.importTags();
  if (imported) {
    await window.tagsAPI.write(imported);
    renderOrganTags();
  }
});
