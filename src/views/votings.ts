import { t } from '../i18n';
import { currentAddress, isOffline } from '../state';
import { show } from '../utils';
import { showDashboard } from './dashboard';
import { showCreateVoting } from './createVoting';

// ---- State ----
interface VotingRow {
  id: string;
  author: string;
  startTime: number;
  endTime: number;
  typeKey: string;
  finalized: boolean;
  finalizedSuccess?: boolean;
}
let votingsCurrentTab: 'active' | 'past' = 'active';
let votingsRows: VotingRow[] = [];
let castTargetId: string | null = null;
let castSupport = true;
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// ---- DOM refs ----
const votingsBackBtn    = document.getElementById('votings-back-btn')    as HTMLButtonElement;
const votingsCreateBtn  = document.getElementById('votings-create-btn')  as HTMLButtonElement;
const votingsRefreshBtn = document.getElementById('votings-refresh-btn') as HTMLButtonElement;
const votingsTabActive  = document.getElementById('votings-tab-active')  as HTMLButtonElement;
const votingsTabPast    = document.getElementById('votings-tab-past')    as HTMLButtonElement;
const votingsList       = document.getElementById('votings-list')        as HTMLElement;
const castVotePanel     = document.getElementById('cast-vote-panel')     as HTMLElement;
const castVoteLabel     = document.getElementById('cast-vote-label')     as HTMLElement;
const castForBtn        = document.getElementById('cast-for-btn')        as HTMLButtonElement;
const castAgainstBtn    = document.getElementById('cast-against-btn')    as HTMLButtonElement;
const castOrganSelect   = document.getElementById('cast-organ-select')   as HTMLSelectElement;
const castConfirmBtn    = document.getElementById('cast-confirm-btn')    as HTMLButtonElement;
const castCancelBtn     = document.getElementById('cast-cancel-btn')     as HTMLButtonElement;
const castStatus        = document.getElementById('cast-status')         as HTMLElement;

// ---- Translations (called from renderer applyTranslations) ----
export function applyVotingsTranslations(): void {
  (document.getElementById('votings-title') as HTMLElement).textContent = t('votings.title');
  votingsBackBtn.textContent    = t('votings.back');
  votingsCreateBtn.textContent  = t('votings.createBtn');
  votingsRefreshBtn.textContent = t('votings.refresh');
  votingsTabActive.textContent  = t('votings.tabActive');
  votingsTabPast.textContent    = t('votings.tabPast');
  castForBtn.textContent        = t('votings.for');
  castAgainstBtn.textContent    = t('votings.against');
  castConfirmBtn.textContent    = t('votings.confirm');
  castCancelBtn.textContent     = t('votings.cancel');
}

// ---- Helpers ----
function formatDeadline(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return t('votings.expired');
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

// ---- Data loading ----
async function loadVotings(): Promise<VotingRow[]> {
  const typeEventNames = [
    'NumericalValueVotingCreated',
    'CategoricalValueVotingCreated',
    'CategoryVotingCreated',
    'DecimalsVotingCreated',
    'MembershipVotingCreated',
    'MembershipRevocationVotingCreated',
    'ThemeVotingCreated',
    'StatementVotingCreated',
  ] as const;

  const typeKeyMap: Record<string, string> = {
    NumericalValueVotingCreated:       'numericalValue',
    CategoricalValueVotingCreated:     'categoricalValue',
    CategoryVotingCreated:             'category',
    DecimalsVotingCreated:             'decimals',
    MembershipVotingCreated:           'membership',
    MembershipRevocationVotingCreated: 'membershipRevocation',
    ThemeVotingCreated:                'theme',
    StatementVotingCreated:            'statement',
  };

  const [created, finalized, ...typeLogs] = await Promise.all([
    window.zaryaAPI.getLogs('VotingCreated'),
    window.zaryaAPI.getLogs('VotingFinalized'),
    ...typeEventNames.map(ev => window.zaryaAPI.getLogs(ev).catch(() => [] as unknown[])),
  ]);

  const typeById = new Map<string, string>();
  typeEventNames.forEach((ev, i) => {
    for (const log of typeLogs[i]) {
      const a = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
      const id = String(a.votingId ?? '');
      if (id) typeById.set(id, typeKeyMap[ev]);
    }
  });

  const finalizedMap = new Map<string, boolean>();
  for (const log of finalized) {
    const a = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
    const id = String(a.votingId ?? '');
    if (id) finalizedMap.set(id, Boolean(a.success));
  }

  return created
    .map(log => {
      const a = ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
      const id = String(a.votingId ?? '');
      return {
        id,
        author:           String(a.author ?? ''),
        startTime:        Number(a.startTime ?? 0),
        endTime:          Number(a.endTime ?? 0),
        typeKey:          typeById.get(id) ?? '',
        finalized:        finalizedMap.has(id),
        finalizedSuccess: finalizedMap.get(id),
      };
    })
    .filter(v => v.id !== '');
}

// ---- Rendering ----
function renderVotingsList(): void {
  const now = Math.floor(Date.now() / 1000);
  const filtered = votingsRows
    .filter(v => {
      const active = !v.finalized && v.endTime > now;
      return votingsCurrentTab === 'active' ? active : !active;
    })
    .sort((a, b) => b.endTime - a.endTime);

  if (filtered.length === 0) {
    votingsList.innerHTML = `<p class="votings__empty">${t('votings.empty')}</p>`;
    return;
  }

  votingsList.innerHTML = filtered
    .map(v => {
      const expired = v.endTime <= now;
      const canExecute = !v.finalized && expired;
      const typeLabel = t(`votings.types.${v.typeKey}`);
      const deadlineHtml = v.finalized
        ? `<span class="voting-row__finalized-badge voting-row__finalized-badge--${v.finalizedSuccess ? 'ok' : 'fail'}">${v.finalizedSuccess ? '✓' : '✗'} ${t('votings.finalized')}</span>`
        : `<span class="voting-row__deadline" data-deadline="${v.endTime}">${formatDeadline(v.endTime)}</span>`;

      const actionsHtml = [
        !v.finalized && !expired
          ? `<button class="btn btn--sm voting-row__cast-btn" data-cast="${v.id}">${t('votings.castVote')}</button>`
          : '',
        canExecute
          ? `<div class="voting-row__exec" data-exec="${v.id}" style="display:none">
               <input class="field__input field__input--sm" type="number" min="0" value="0" placeholder="${t('votings.quorum')}" data-quorum />
               <input class="field__input field__input--sm" type="number" min="0" max="100" value="50" placeholder="${t('votings.approval')}" data-approval />
               <button class="btn btn--sm btn--outline">${t('votings.execute')}</button>
             </div>`
          : '',
      ].join('');

      return `<div class="voting-row voting-row--${v.finalized ? 'finalized' : (expired ? 'expired' : 'active')}" data-row="${v.id}">
        <div class="voting-row__header">
          <span class="voting-row__id">#${v.id}</span>
          <span class="voting-row__type-badge">${typeLabel}</span>
          ${deadlineHtml}
        </div>
        <div class="voting-row__meta">${t('votings.by')} <code>${shortAddress(v.author)}</code></div>
        <div class="voting-row__counts" data-votes="${v.id}">
          <span class="voting-row__for">↑ —</span>
          <span class="voting-row__against">↓ —</span>
        </div>
        <div class="voting-row__actions">${actionsHtml}</div>
      </div>`;
    })
    .join('');

  // Async: fill vote counts and check hasVoted per row
  filtered.forEach(v => {
    window.zaryaAPI
      .read('getVotingResults', [BigInt(v.id)])
      .then(res => {
        const r = res as { forVotes: bigint; againstVotes: bigint };
        const el = votingsList.querySelector<HTMLElement>(`[data-votes="${v.id}"]`);
        if (!el) return;
        el.querySelector<HTMLElement>('.voting-row__for')!.textContent    = `↑ ${String(r.forVotes)}`;
        el.querySelector<HTMLElement>('.voting-row__against')!.textContent = `↓ ${String(r.againstVotes)}`;
        if (r.forVotes > 0n || r.againstVotes > 0n) {
          const execDiv = votingsList.querySelector<HTMLElement>(`[data-exec="${v.id}"]`);
          if (execDiv) execDiv.style.display = '';
        }
      })
      .catch(() => {});

    if (!v.finalized && v.endTime > Math.floor(Date.now() / 1000) && currentAddress) {
      window.zaryaAPI
        .read('hasVoted', [BigInt(v.id), currentAddress])
        .then(voted => {
          if (!voted) return;
          const btn = votingsList.querySelector<HTMLButtonElement>(`[data-cast="${v.id}"]`);
          if (!btn) return;
          btn.textContent = t('votings.voted');
          btn.disabled = true;
        })
        .catch(() => {});
    }
  });

  // Cast vote buttons
  votingsList.querySelectorAll<HTMLButtonElement>('.voting-row__cast-btn').forEach(btn => {
    btn.addEventListener('click', () => { if (!btn.disabled) openCastPanel(btn.dataset.cast!); });
  });

  // Execute buttons
  votingsList.querySelectorAll<HTMLElement>('[data-exec]').forEach(div => {
    const id = div.dataset.exec!;
    const execBtn = div.querySelector<HTMLButtonElement>('button')!;
    execBtn.addEventListener('click', async () => {
      if (isOffline) {
        let errEl = div.querySelector<HTMLElement>('.voting-row__exec-status');
        if (!errEl) { errEl = document.createElement('span'); errEl.className = 'voting-row__exec-status'; div.appendChild(errEl); }
        errEl.textContent = t('offline.readOnly');
        return;
      }
      const quorum   = BigInt(parseInt((div.querySelector<HTMLInputElement>('[data-quorum]')!).value  || '0',  10));
      const approval = BigInt(parseInt((div.querySelector<HTMLInputElement>('[data-approval]')!).value || '50', 10));
      execBtn.disabled = true;
      execBtn.textContent = t('votings.sendingTx');
      try {
        const hash = await window.zaryaAPI.write('executeVoting', [BigInt(id), quorum, approval]);
        execBtn.textContent = t('votings.waitingTx');
        await window.zaryaAPI.waitTx(hash);
        execBtn.textContent = t('votings.txDone');
        await refreshVotings();
      } catch (e) {
        execBtn.disabled = false;
        execBtn.textContent = t('votings.execute');
        let errEl = div.querySelector<HTMLElement>('.voting-row__exec-status');
        if (!errEl) {
          errEl = document.createElement('span');
          errEl.className = 'voting-row__exec-status';
          div.appendChild(errEl);
        }
        errEl.textContent = e instanceof Error ? e.message : t('votings.txError');
      }
    });
  });
}

// ---- Cast panel ----
async function openCastPanel(votingId: string): Promise<void> {
  castTargetId = votingId;
  castSupport  = true;
  castVoteLabel.textContent = `${t('votings.castVote')} #${votingId}`;
  castForBtn.classList.add('cast-vote-panel__btn--active');
  castAgainstBtn.classList.remove('cast-vote-panel__btn--active');
  castStatus.textContent = '';

  castOrganSelect.innerHTML = '';
  const tags = await window.tagsAPI.read();
  const resolved = tags.filter(tg => !!tg.organ);

  if (resolved.length === 0) {
    const opt = document.createElement('option');
    opt.value = ''; opt.disabled = true; opt.selected = true;
    opt.textContent = t('votings.noMemberOrgans');
    castOrganSelect.appendChild(opt);
  } else {
    const placeholder = document.createElement('option');
    placeholder.value = ''; placeholder.disabled = true; placeholder.selected = true;
    placeholder.textContent = t('votings.selectOrgan');
    castOrganSelect.appendChild(placeholder);

    for (const tg of resolved) {
      const opt = document.createElement('option');
      opt.value = tg.organ!;
      opt.textContent = tg.code;
      castOrganSelect.appendChild(opt);
    }
    if (currentAddress) {
      for (const tg of resolved) {
        const ok = await window.zaryaAPI.checkOrgan(tg.organ!, currentAddress).catch(() => false);
        if (ok) { castOrganSelect.value = tg.organ!; break; }
      }
    }
  }

  castVotePanel.style.display = '';
}

function closeCastPanel(): void {
  castVotePanel.style.display = 'none';
  castTargetId = null;
  castStatus.textContent = '';
}

async function refreshVotings(): Promise<void> {
  votingsRows = await loadVotings();
  renderVotingsList();
}

export async function showVotings(): Promise<void> {
  show('votings-view');
  closeCastPanel();
  votingsCurrentTab = 'active';
  votingsTabActive.classList.add('votings__tab--active');
  votingsTabPast.classList.remove('votings__tab--active');

  // Loading skeleton
  votingsList.innerHTML = Array(3).fill(0).map(() =>
    `<div class="voting-row skeleton-row">
       <div class="skeleton-row__line skeleton-row__line--title"></div>
       <div class="skeleton-row__line skeleton-row__line--meta"></div>
       <div class="skeleton-row__line skeleton-row__line--counts"></div>
     </div>`,
  ).join('');

  await Promise.all([
    window.zaryaAPI.watch('VotingCreated'),
    window.zaryaAPI.watch('VotingFinalized'),
    window.zaryaAPI.watch('VoteCasted'),
  ]).catch(() => {});

  await refreshVotings();

  // Start countdown timer
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    votingsList.querySelectorAll<HTMLElement>('[data-deadline]').forEach(el => {
      el.textContent = formatDeadline(parseInt(el.dataset.deadline!, 10));
    });
  }, 1000);
}

// ---- Event handlers ----
castForBtn.addEventListener('click', () => {
  castSupport = true;
  castForBtn.classList.add('cast-vote-panel__btn--active');
  castAgainstBtn.classList.remove('cast-vote-panel__btn--active');
});

castAgainstBtn.addEventListener('click', () => {
  castSupport = false;
  castAgainstBtn.classList.add('cast-vote-panel__btn--active');
  castForBtn.classList.remove('cast-vote-panel__btn--active');
});

castCancelBtn.addEventListener('click', () => closeCastPanel());

castConfirmBtn.addEventListener('click', async () => {
  if (!castTargetId) return;
  if (isOffline) { castStatus.textContent = t('offline.readOnly'); return; }
  const organ = castOrganSelect.value;
  if (!organ) { castStatus.textContent = t('votings.selectOrgan'); return; }
  castConfirmBtn.disabled = true;
  castStatus.textContent = t('votings.sendingTx');
  try {
    const hash = await window.zaryaAPI.write('castVote', [BigInt(castTargetId), castSupport, organ as `0x${string}`]);
    castStatus.textContent = t('votings.waitingTx');
    await window.zaryaAPI.waitTx(hash);
    castStatus.textContent = t('votings.txDone');
    closeCastPanel();
    await refreshVotings();
  } catch (e) {
    castStatus.textContent = e instanceof Error ? e.message : t('votings.txError');
  } finally {
    castConfirmBtn.disabled = false;
  }
});

votingsCreateBtn.addEventListener('click', () => {
  showCreateVoting({ back: () => showVotings() });
});
votingsBackBtn.addEventListener('click', async () => {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  await Promise.all([
    window.zaryaAPI.unwatch('VotingCreated'),
    window.zaryaAPI.unwatch('VotingFinalized'),
    window.zaryaAPI.unwatch('VoteCasted'),
  ]).catch(() => {});
  await showDashboard(currentAddress);
});

votingsRefreshBtn.addEventListener('click', () => refreshVotings());

votingsTabActive.addEventListener('click', () => {
  votingsCurrentTab = 'active';
  votingsTabActive.classList.add('votings__tab--active');
  votingsTabPast.classList.remove('votings__tab--active');
  renderVotingsList();
});

votingsTabPast.addEventListener('click', () => {
  votingsCurrentTab = 'past';
  votingsTabPast.classList.add('votings__tab--active');
  votingsTabActive.classList.remove('votings__tab--active');
  renderVotingsList();
});

window.zaryaAPI.onEvent((eventName) => {
  if (
    ['VotingCreated', 'VotingFinalized', 'VoteCasted'].includes(eventName) &&
    (document.getElementById('votings-view') as HTMLElement).style.display !== 'none'
  ) {
    refreshVotings();
  }
});
