import { t } from '../i18n';
import { show } from '../utils';
import { currentAddress } from '../state';
import { showDashboard } from './dashboard';
import { showCreateVoting } from './createVoting';
import { aggregateNumerical, aggregateCategorical } from './aggregation';

// ---- State ----
type MatrixMode = 'numerical' | 'categorical';
let matrixMode: MatrixMode = 'numerical';
let matrixXs: bigint[] = [];
let matrixYs: bigint[] = [];
let matrixThemes     = new Map<string, string>(); // x.toString() → name
let matrixStatements = new Map<string, string>(); // y.toString() → name

// Cell detail state
let detailX: bigint = 0n;
let detailY: bigint = 0n;
let detailDecimals    = 0;
let detailSampleLen: bigint = 0n;
let detailHistOffset: bigint = 0n;

const HISTORY_PAGE = 20n;

// ---- DOM refs ----
const matrixBackBtn       = document.getElementById('matrix-back-btn')       as HTMLButtonElement;
const matrixRefreshBtn    = document.getElementById('matrix-refresh-btn')    as HTMLButtonElement;
const matrixTabNumerical  = document.getElementById('matrix-tab-numerical')  as HTMLButtonElement;
const matrixTabCategorical = document.getElementById('matrix-tab-categorical') as HTMLButtonElement;
const matrixLoading       = document.getElementById('matrix-loading')        as HTMLElement;
const matrixTableWrap     = document.getElementById('matrix-table-wrap')     as HTMLElement;
const matrixTable         = document.getElementById('matrix-table')          as HTMLTableElement;
const cellBackBtn         = document.getElementById('cell-back-btn')         as HTMLButtonElement;
const cellTitleEl         = document.getElementById('cell-title')            as HTMLElement;
const cellOrganEl         = document.getElementById('cell-organ')            as HTMLElement;
const cellAggregationEl   = document.getElementById('cell-aggregation')      as HTMLElement;
const cellHistoryEl       = document.getElementById('cell-history')          as HTMLElement;
const cellLoadMoreBtn     = document.getElementById('cell-load-more-btn')    as HTMLButtonElement;
const cellProposeBtn      = document.getElementById('cell-propose-btn')      as HTMLButtonElement;

// ---- Translations ----
export function applyMatrixTranslations(): void {
  (document.getElementById('matrix-title') as HTMLElement).textContent = t('matrix.title');
  matrixBackBtn.textContent        = t('matrix.back');
  matrixRefreshBtn.textContent     = t('votings.refresh');
  matrixTabNumerical.textContent   = t('matrix.tabNumerical');
  matrixTabCategorical.textContent = t('matrix.tabCategorical');
  cellBackBtn.textContent          = t('matrix.cellBack');
  cellLoadMoreBtn.textContent      = t('matrix.loadMore');
  cellProposeBtn.textContent       = t('matrix.proposeValue');
}

// ---- Helpers ----
function shortAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function getArgs(log: unknown): Record<string, unknown> {
  return ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
}

// ---- Dimension discovery ----
async function discoverDimensions(isCategorical: boolean): Promise<{
  xs: bigint[];
  ys: bigint[];
  themes: Map<string, string>;
  statements: Map<string, string>;
  dataCells: Set<string>; // `${x},${y}` pairs with actual value events
}> {
  const [themeEvents, stmtEvents, numEvents, catEvents] = await Promise.all([
    window.zaryaAPI.getLogs('ThemeVotingCreated'),
    window.zaryaAPI.getLogs('StatementVotingCreated'),
    isCategorical
      ? Promise.resolve([] as unknown[])
      : window.zaryaAPI.getLogs('NumericalValueVotingCreated'),
    isCategorical
      ? window.zaryaAPI.getLogs('CategoricalValueVotingCreated')
      : Promise.resolve([] as unknown[]),
  ]);

  const xSet      = new Set<string>();
  const ySet      = new Set<string>();
  const dataSet   = new Set<string>();

  for (const log of themeEvents) {
    const a = getArgs(log);
    if (Boolean(a.isCategorical) !== isCategorical) continue;
    if (a.x !== undefined) xSet.add(String(a.x));
  }

  for (const log of stmtEvents) {
    const a = getArgs(log);
    if (Boolean(a.isCategorical) !== isCategorical) continue;
    if (a.x !== undefined) xSet.add(String(a.x));
    if (a.y !== undefined) ySet.add(String(a.y));
  }

  const valueEvents = isCategorical ? catEvents : numEvents;
  for (const log of valueEvents) {
    const a = getArgs(log);
    if (a.x !== undefined) xSet.add(String(a.x));
    if (a.y !== undefined) ySet.add(String(a.y));
    if (a.x !== undefined && a.y !== undefined) dataSet.add(`${a.x},${a.y}`);
  }

  const sortBigint = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  const xs = [...xSet].map(BigInt).sort(sortBigint);
  const ys = [...ySet].map(BigInt).sort(sortBigint);

  // Resolve theme/statement names in parallel (small N)
  const [themeEntries, stmtEntries] = await Promise.all([
    Promise.all(xs.map(async x => {
      try {
        const name = (await window.zaryaAPI.read('getTheme', [isCategorical, x])) as string;
        return [x.toString(), name || `T${x}`] as [string, string];
      } catch { return [x.toString(), `T${x}`] as [string, string]; }
    })),
    Promise.all(ys.map(async y => {
      try {
        const name = (await window.zaryaAPI.read('getStatement', [isCategorical, y])) as string;
        return [y.toString(), name || `S${y}`] as [string, string];
      } catch { return [y.toString(), `S${y}`] as [string, string]; }
    })),
  ]);

  return {
    xs,
    ys,
    themes:     new Map(themeEntries),
    statements: new Map(stmtEntries),
    dataCells:  dataSet,
  };
}

// ---- Render matrix table ----
async function renderMatrixTable(): Promise<void> {
  const isCat = matrixMode === 'categorical';

  matrixLoading.textContent    = t('matrix.loading');
  matrixLoading.style.display  = '';
  matrixTableWrap.style.display = 'none';
  matrixTable.innerHTML        = '';

  const { xs, ys, themes, statements, dataCells } = await discoverDimensions(isCat);
  matrixXs         = xs;
  matrixYs         = ys;
  matrixThemes     = themes;
  matrixStatements = statements;

  if (xs.length === 0 || ys.length === 0) {
    matrixLoading.textContent = t('matrix.empty');
    return;
  }

  // Build table HTML
  let html = '<thead><tr><th class="matrix__corner"></th>';
  for (const y of ys) {
    const label = statements.get(y.toString()) ?? `S${y}`;
    html += `<th class="matrix__th-y" title="${label}">${label}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const x of xs) {
    const themeLabel = themes.get(x.toString()) ?? `T${x}`;
    html += `<tr><th class="matrix__th-x" title="${themeLabel}">${themeLabel}</th>`;
    for (const y of ys) {
      const key     = `${x},${y}`;
      const hasData = dataCells.has(key);
      html += `<td class="matrix__cell${hasData ? ' matrix__cell--data' : ''}" data-x="${x}" data-y="${y}">`;
      html += hasData
        ? `<span class="matrix__cell-count" data-count="${key}">…</span>`
        : `<span class="matrix__cell-empty">—</span>`;
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody>';
  matrixTable.innerHTML = html;

  matrixLoading.style.display   = 'none';
  matrixTableWrap.style.display = '';

  // Attach click handlers
  matrixTable.querySelectorAll<HTMLTableCellElement>('.matrix__cell--data').forEach(td => {
    td.addEventListener('click', () => openCellDetail(BigInt(td.dataset.x!), BigInt(td.dataset.y!)));
  });

  // Async: fill sample lengths
  // getNumericalCellInfo → [organ, decimals, sampleLength]
  // getCategoricalCellInfo → [organ, allowedCategories, sampleLength]
  // viem may return a named object OR a tuple array; handle both.
  const getCellInfoFn = isCat ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
  for (const key of dataCells) {
    const [xs, ys] = key.split(',');
    window.zaryaAPI
      .read(getCellInfoFn, [BigInt(xs), BigInt(ys)])
      .then(res => {
        const r = res as Record<string, unknown> | unknown[];
        const sampleLength = Array.isArray(r)
          ? (r[2] as bigint | undefined)
          : ((r as Record<string, unknown>).sampleLength as bigint | undefined);
        const el = matrixTable.querySelector<HTMLElement>(`[data-count="${key}"]`);
        if (el) el.textContent = sampleLength !== undefined ? String(sampleLength) : '?';
      })
      .catch(() => {
        const el = matrixTable.querySelector<HTMLElement>(`[data-count="${key}"]`);
        if (el) el.textContent = '?';
      });
  }
}

// ---- Cell detail ----
async function openCellDetail(x: bigint, y: bigint): Promise<void> {
  detailX           = x;
  detailY           = y;
  detailHistOffset  = 0n;
  const isCat       = matrixMode === 'categorical';

  const themeName = matrixThemes.get(x.toString())     ?? `T${x}`;
  const stmtName  = matrixStatements.get(y.toString()) ?? `S${y}`;
  cellTitleEl.textContent     = `${themeName} × ${stmtName}`;
  cellOrganEl.innerHTML       = t('matrix.loading');
  cellAggregationEl.innerHTML = '';
  cellHistoryEl.innerHTML     = '';
  cellLoadMoreBtn.style.display = 'none';

  show('cell-detail-view');

  const getCellInfoFn = isCat ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
  try {
    const res = await window.zaryaAPI.read(getCellInfoFn, [x, y]);
    // Handle both named object and tuple array from viem
    // Numerical:   [organ, decimals, sampleLength]
    // Categorical: [organ, allowedCategories, sampleLength]
    const r = res as Record<string, unknown> | unknown[];
    const organ            = (Array.isArray(r) ? r[0] : r.organ)            as `0x${string}` | undefined;
    const sampleLength     = (Array.isArray(r) ? r[2] : r.sampleLength)     as bigint        | undefined;
    const decimals         = (Array.isArray(r) ? (isCat ? undefined : r[1]) : r.decimals)    as number        | undefined;

    detailSampleLen = sampleLength ?? 0n;
    detailDecimals  = decimals     ?? 0;

    // Resolve organ from local tags
    const tags     = await window.tagsAPI.read();
    const organLc  = organ?.toLowerCase();
    const organTag = organLc ? tags.find(tg => tg.organ?.toLowerCase() === organLc) : undefined;
    cellOrganEl.innerHTML =
      `<span class="cell-detail__organ-label">${t('matrix.organ')}</span> ` +
      `<code class="cell-detail__organ-code">${organTag ? organTag.code : organ ? shortAddr(organ) : '—'}</code>`;

    await loadHistory(isCat, x, y, 0n, detailSampleLen, detailDecimals, true);
  } catch (e) {
    cellOrganEl.innerHTML =
      `<span class="cell-detail__error">${e instanceof Error ? e.message : t('matrix.loadError')}</span>`;
  }
}

async function loadHistory(
  isCat: boolean,
  x: bigint,
  y: bigint,
  offset: bigint,
  sampleLen: bigint,
  decimals: number,
  isFirst: boolean,
): Promise<void> {
  const getFn = isCat ? 'getCategoricalHistory' : 'getNumericalHistory';
  const histRaw = (await window.zaryaAPI.read(getFn, [x, y, offset, HISTORY_PAGE])) as {
    timestamps?: number[];
    authors?:    string[];
    values?:     bigint[];
  };
  const hist = {
    timestamps: histRaw?.timestamps ?? [],
    authors:    histRaw?.authors    ?? [],
    values:     histRaw?.values     ?? [],
  };

  // Pre-fetch category names for categorical mode
  let catNames: Map<string, string> | undefined;
  if (isCat && hist.values.length > 0) {
    catNames = new Map();
    const unique = [...new Set(hist.values.map(v => v.toString()))];
    await Promise.all(unique.map(async catStr => {
      try {
        const name = (await window.zaryaAPI.read('getCategoryName', [x, y, BigInt(catStr)])) as string;
        catNames!.set(catStr, name || catStr);
      } catch { catNames!.set(catStr, catStr); }
    }));
  }

  const rows = hist.timestamps.map((ts, i) => {
    const val = hist.values[i];
    let displayVal: string;
    if (isCat) {
      displayVal = catNames?.get(val.toString()) ?? val.toString();
    } else if (decimals > 0) {
      const divisor = BigInt(10 ** decimals);
      const whole   = val / divisor;
      const frac    = val % divisor;
      displayVal    = `${whole}.${String(frac).padStart(decimals, '0')}`;
    } else {
      displayVal = val.toString();
    }
    return `<tr class="cell-detail__history-row">
      <td class="cell-detail__history-ts">${formatTimestamp(ts)}</td>
      <td class="cell-detail__history-author"><code>${shortAddr(hist.authors[i])}</code></td>
      <td class="cell-detail__history-val">${displayVal}</td>
    </tr>`;
  }).join('');

  if (isFirst) {
    // Render aggregation + initial table
    await renderAggregation(isCat, x, y, sampleLen, decimals, catNames);
    cellHistoryEl.innerHTML = hist.timestamps.length > 0
      ? `<table class="cell-detail__history-table">
           <thead><tr>
             <th>${t('matrix.historyTime')}</th>
             <th>${t('matrix.historyAuthor')}</th>
             <th>${t('matrix.historyValue')}</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`
      : `<p class="cell-detail__empty">${t('matrix.noHistory')}</p>`;
  } else {
    const tbody = cellHistoryEl.querySelector('tbody');
    if (tbody) tbody.insertAdjacentHTML('beforeend', rows);
  }

  detailHistOffset = offset + BigInt(hist.timestamps.length);
  cellLoadMoreBtn.style.display = detailHistOffset < sampleLen ? '' : 'none';
}

async function renderAggregation(
  isCat: boolean,
  x: bigint,
  y: bigint,
  sampleLen: bigint,
  decimals: number,
  catNames?: Map<string, string>,
): Promise<void> {
  if (sampleLen === 0n) {
    cellAggregationEl.innerHTML =
      `<p class="cell-detail__empty">${t('matrix.noData')}</p>`;
    return;
  }

  // Load up to 200 samples for aggregation
  const aggLimit = sampleLen < 200n ? sampleLen : 200n;
  const getFn    = isCat ? 'getCategoricalHistory' : 'getNumericalHistory';
  const histRaw  = (await window.zaryaAPI.read(getFn, [x, y, 0n, aggLimit])) as {
    timestamps?: number[];
    authors?:    string[];
    values?:     bigint[];
  };
  const hist = {
    timestamps: histRaw?.timestamps ?? [],
    authors:    histRaw?.authors    ?? [],
    values:     histRaw?.values     ?? [],
  };

  if (isCat) {
    const agg    = aggregateCategorical(hist.values, catNames);
    const bars   = agg.distribution.map(({ key, pct }) =>
      `<div class="cell-detail__bar-row">
        <span class="cell-detail__bar-label" title="${key}">${key}</span>
        <div class="cell-detail__bar-track">
          <div class="cell-detail__bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="cell-detail__bar-pct">${pct}%</span>
      </div>`,
    ).join('');

    cellAggregationEl.innerHTML =
      `<div class="cell-detail__agg">
         <p class="cell-detail__agg-stat">${t('matrix.mode')}: <strong>${agg.mode}</strong></p>
         <div class="cell-detail__bars">${bars}</div>
         <p class="cell-detail__agg-muted">${t('matrix.basedOn').replace('{n}', String(agg.count))}</p>
       </div>`;
  } else {
    const agg = aggregateNumerical(hist.values, decimals);
    const fmt = (n: number) => n.toFixed(decimals > 0 ? decimals : 2);

    cellAggregationEl.innerHTML =
      `<div class="cell-detail__agg">
         <p class="cell-detail__agg-stat">${t('matrix.mean')}: <strong>${fmt(agg.mean)}</strong></p>
         <p class="cell-detail__agg-stat">${t('matrix.stdev')}: <strong>±${fmt(agg.stdev)}</strong></p>
         <p class="cell-detail__agg-muted">${t('matrix.basedOn').replace('{n}', String(agg.count))}</p>
       </div>`;
  }
}

// ---- Public API ----
export async function showMatrix(): Promise<void> {
  matrixMode = 'numerical';
  matrixTabNumerical.classList.add('matrix__tab--active');
  matrixTabCategorical.classList.remove('matrix__tab--active');
  matrixLoading.textContent     = t('matrix.loading');
  matrixLoading.style.display   = '';
  matrixTableWrap.style.display = 'none';
  show('matrix-view');
  await renderMatrixTable();
}

// ---- Event handlers ----
matrixBackBtn.addEventListener('click', async () => showDashboard(currentAddress));
matrixRefreshBtn.addEventListener('click', () => renderMatrixTable());

matrixTabNumerical.addEventListener('click', async () => {
  if (matrixMode === 'numerical') return;
  matrixMode = 'numerical';
  matrixTabNumerical.classList.add('matrix__tab--active');
  matrixTabCategorical.classList.remove('matrix__tab--active');
  await renderMatrixTable();
});

matrixTabCategorical.addEventListener('click', async () => {
  if (matrixMode === 'categorical') return;
  matrixMode = 'categorical';
  matrixTabCategorical.classList.add('matrix__tab--active');
  matrixTabNumerical.classList.remove('matrix__tab--active');
  await renderMatrixTable();
});

cellBackBtn.addEventListener('click', () => show('matrix-view'));

cellLoadMoreBtn.addEventListener('click', async () => {
  cellLoadMoreBtn.disabled = true;
  await loadHistory(
    matrixMode === 'categorical',
    detailX, detailY,
    detailHistOffset,
    detailSampleLen,
    detailDecimals,
    false,
  );
  cellLoadMoreBtn.disabled = false;
});

cellProposeBtn.addEventListener('click', () => {
  showCreateVoting({
    isCategorical: matrixMode === 'categorical',
    x: detailX,
    y: detailY,
    back: () => show('cell-detail-view'),
  });
});
