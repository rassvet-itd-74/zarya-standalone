<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { readContract, getLogs } from '../services/zaryaService';
import type { MatrixMode } from '../types/matrix';
import type { CellDetailContext } from '../types/matrix';
import CellDetailView from './CellDetailView.vue';

const { t } = useI18n();
const { navigate, isOffline, cellDetailContext } = useAppState();

const mode    = ref<MatrixMode>('numerical');
const loading = ref(false);

const xs         = ref<bigint[]>([]);
const ys         = ref<bigint[]>([]);
const themes     = ref<Map<string, string>>(new Map());
const statements = ref<Map<string, string>>(new Map());
const dataCells  = ref<Set<string>>(new Set());
const cellCounts = ref<Map<string, string>>(new Map());

const showDetail = computed(() => cellDetailContext.value !== null);

function getArgs(log: unknown): Record<string, unknown> {
  return ((log as Record<string, unknown>).args as Record<string, unknown>) ?? {};
}

async function discoverDimensions(isCat: boolean) {
  const [numLogs, catLogs, stmtLogs] = await Promise.all([
    getLogs('NumericalValueVotingCreated').catch(() => []),
    getLogs('CategoricalValueVotingCreated').catch(() => []),
    getLogs('StatementVotingCreated').catch(() => []),
  ]);

  const xSet = new Set<string>();
  const ySet = new Set<string>();
  const dataSet = new Set<string>();

  for (const log of stmtLogs) {
    const a = getArgs(log);
    if (Boolean(a.isCategorical) !== isCat) continue;
    if (a.x !== undefined) xSet.add(String(a.x));
    if (a.y !== undefined) ySet.add(String(a.y));
  }

  const valueLogs = isCat ? catLogs : numLogs;
  for (const log of valueLogs) {
    const a = getArgs(log);
    if (a.x !== undefined) xSet.add(String(a.x));
    if (a.y !== undefined) ySet.add(String(a.y));
    if (a.x !== undefined && a.y !== undefined) dataSet.add(`${a.x},${a.y}`);
  }

  const sortBigint = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  const xsSorted = [...xSet].map(BigInt).sort(sortBigint);
  const ysSorted = [...ySet].map(BigInt).sort(sortBigint);

  const [themeEntries, stmtEntries] = await Promise.all([
    Promise.all(xsSorted.map(async x => {
      try {
        const name = await readContract<string>('getTheme', [isCat, x]);
        return [x.toString(), name || `T${x}`] as [string, string];
      } catch { return [x.toString(), `T${x}`] as [string, string]; }
    })),
    Promise.all(ysSorted.map(async y => {
      try {
        const name = await readContract<string>('getStatement', [isCat, y]);
        return [y.toString(), name || `S${y}`] as [string, string];
      } catch { return [y.toString(), `S${y}`] as [string, string]; }
    })),
  ]);

  return {
    xs: xsSorted,
    ys: ysSorted,
    themes:    new Map(themeEntries),
    statements: new Map(stmtEntries),
    dataCells:  dataSet,
  };
}

async function loadMatrix(): Promise<void> {
  if (loading.value) return;
  loading.value = true;
  cellCounts.value = new Map();
  try {
    const isCat = mode.value === 'categorical';
    const dim = await discoverDimensions(isCat);
    isOffline.value = false;
    xs.value         = dim.xs;
    ys.value         = dim.ys;
    themes.value     = dim.themes;
    statements.value = dim.statements;
    dataCells.value  = dim.dataCells;

    // Async fill cell counts
    const fn = isCat ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
    for (const key of dim.dataCells) {
      const [kx, ky] = key.split(',');
      readContract<unknown>( fn, [BigInt(kx!), BigInt(ky!)])
        .then(res => {
          const r = res as Record<string, unknown> | unknown[];
          const sampleLength = Array.isArray(r)
            ? (r[2] as bigint | undefined)
            : ((r as Record<string, unknown>).sampleLength as bigint | undefined);
          cellCounts.value.set(key, sampleLength !== undefined ? String(sampleLength) : '?');
          cellCounts.value = new Map(cellCounts.value);
        })
        .catch(() => { cellCounts.value.set(key, '?'); cellCounts.value = new Map(cellCounts.value); });
    }
  } catch {
    isOffline.value = true;
  } finally {
    loading.value = false;
  }
}

function openCell(x: bigint, y: bigint): void {
  const isCat = mode.value === 'categorical';
  const fn = isCat ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
  readContract<unknown>(fn, [x, y]).then(info => {
    const r = info as Record<string, unknown> | unknown[];
    const decimals = (Array.isArray(r) ? (isCat ? 0 : Number(r[1] ?? 0)) : Number((r as Record<string,unknown>).decimals ?? 0));
    cellDetailContext.value = { x, y, decimals, isCategorical: isCat };
  }).catch(() => {
    cellDetailContext.value = { x, y, decimals: 0, isCategorical: isCat };
  });
}

function setMode(m: MatrixMode): void {
  if (mode.value === m) return;
  mode.value = m;
  loadMatrix();
}

onMounted(loadMatrix);
</script>

<template>
  <div class="matrix">
    <div v-if="!showDetail">
      <div class="matrix__header">
        <button class="btn btn--ghost btn--sm" @click="navigate('dashboard')">{{ t('matrix.back') }}</button>
        <h2 class="matrix__title">{{ t('matrix.title') }}</h2>
        <button class="btn btn--ghost btn--sm" :disabled="loading" @click="loadMatrix">{{ t('matrix.refresh') }}</button>
      </div>

      <div class="matrix__tabs" role="tablist">
        <button
          class="matrix__tab"
          :class="{ 'matrix__tab--active': mode === 'numerical' }"
          @click="setMode('numerical')"
        >{{ t('matrix.numerical') }}</button>
        <button
          class="matrix__tab"
          :class="{ 'matrix__tab--active': mode === 'categorical' }"
          @click="setMode('categorical')"
        >{{ t('matrix.categorical') }}</button>
      </div>

      <p v-if="loading" class="matrix__loading">{{ t('matrix.loading') }}</p>
      <p v-else-if="xs.length === 0 || ys.length === 0" class="matrix__empty">{{ t('matrix.empty') }}</p>

      <div v-else class="matrix__table-wrap">
        <table class="matrix__table">
          <thead>
            <tr>
              <th class="matrix__corner"></th>
              <th v-for="y in ys" :key="String(y)" class="matrix__th-y" :title="statements.get(String(y)) ?? `S${y}`">
                {{ statements.get(String(y)) ?? `S${y}` }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="x in xs" :key="String(x)">
              <th class="matrix__th-x" :title="themes.get(String(x)) ?? `T${x}`">
                {{ themes.get(String(x)) ?? `T${x}` }}
              </th>
              <td
                v-for="y in ys"
                :key="`${x},${y}`"
                class="matrix__cell"
                :class="{ 'matrix__cell--data': dataCells.has(`${x},${y}`) }"
                @click="dataCells.has(`${x},${y}`) && openCell(x, y)"
              >
                <span v-if="dataCells.has(`${x},${y}`)" class="matrix__cell-count">
                  {{ cellCounts.get(`${x},${y}`) ?? '...' }}
                </span>
                <span v-else class="matrix__cell-empty">--</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <CellDetailView
      v-if="showDetail"
      :x="cellDetailContext!.x"
      :y="cellDetailContext!.y"
      :decimals="cellDetailContext!.decimals"
      :is-categorical="cellDetailContext!.isCategorical"
      :themes="themes"
      :statements="statements"
      @back="cellDetailContext = null"
    />
  </div>
</template>
