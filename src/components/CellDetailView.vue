<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '../composables/useI18n';
import { useAppState } from '../composables/useAppState';
import { readContract } from '../services/zaryaService';
import { readTags } from '../services/tagsService';
import type { NumericalAgg, CategoricalAgg } from '../types/matrix';

const HISTORY_PAGE = 20n;

const props = defineProps<{
  x:             bigint;
  y:             bigint;
  decimals:      number;
  isCategorical: boolean;
  themes:        Map<string, string>;
  statements:    Map<string, string>;
}>();
const emit = defineEmits<{ back: [] }>();

const { t } = useI18n();
const { navigate, createVotingPrefill } = useAppState();

const organLabel   = ref('');
const numAgg       = ref<NumericalAgg | null>(null);
const catAgg       = ref<CategoricalAgg | null>(null);
const history      = ref<Array<{ ts: number; author: string; value: string }>>([]);
const sampleLength = ref(0n);
const histOffset   = ref(0n);
const loadingMore  = ref(false);
const errorKey     = ref('');
const errorMsg     = ref('');

function shortAddr(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function formatVal(val: bigint): string {
  if (props.isCategorical) return val.toString();
  if (props.decimals > 0) {
    const divisor = BigInt(10 ** props.decimals);
    const whole = val / divisor;
    const frac  = val % divisor;
    return `${whole}.${String(frac).padStart(props.decimals, '0')}`;
  }
  return val.toString();
}

function aggregateNumerical(values: bigint[]): NumericalAgg {
  if (values.length === 0) return { mean: 0, stdev: 0, min: 0, max: 0, count: 0 };
  const nums = values.map(v => {
    if (props.decimals > 0) {
      return Number(v) / (10 ** props.decimals);
    }
    return Number(v);
  });
  const n    = nums.length;
  const sum  = nums.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  return {
    mean,
    stdev: Math.sqrt(variance),
    min: Math.min(...nums),
    max: Math.max(...nums),
    count: n,
  };
}

function aggregateCategorical(values: bigint[], catNames: Map<string, string>): CategoricalAgg {
  if (values.length === 0) return { mode: '--', distribution: [], count: 0 };
  const counts = new Map<string, number>();
  for (const v of values) {
    const label = catNames.get(v.toString()) ?? v.toString();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total  = values.length;
  return {
    mode: sorted[0]![0],
    distribution: sorted.map(([key, count]) => ({ key, count, pct: Math.round(count / total * 100) })),
    count: total,
  };
}

function getRawHistory(raw: unknown): { timestamps: number[]; authors: string[]; values: bigint[] } {
  const r = raw as Record<string, unknown> | unknown[];
  return {
    timestamps: (Array.isArray(r) ? r[0] : r['timestamps']) as number[]  ?? [],
    authors:    (Array.isArray(r) ? r[1] : r['authors'])    as string[]  ?? [],
    values:     (Array.isArray(r) ? r[2] : r['values'])     as bigint[]  ?? [],
  };
}

async function loadHistory(isFirst: boolean): Promise<void> {
  const fn  = props.isCategorical ? 'getCategoricalHistory' : 'getNumericalHistory';
  const raw = await readContract<unknown>(fn, [props.x, props.y, histOffset.value, HISTORY_PAGE]);
  const hist = getRawHistory(raw);

  let catNames: Map<string, string> | undefined;
  if (props.isCategorical && hist.values.length > 0) {
    catNames = new Map();
    const unique = [...new Set(hist.values.map(v => v.toString()))];
    await Promise.all(unique.map(async catStr => {
      try {
        const name = await readContract<string>('getCategoryName', [props.x, props.y, BigInt(catStr)]);
        catNames!.set(catStr, name || catStr);
      } catch { catNames!.set(catStr, catStr); }
    }));
  }

  const rows = hist.timestamps.map((ts, i) => {
    const val = hist.values[i] ?? 0n;
    let display: string;
    if (props.isCategorical) {
      display = catNames?.get(val.toString()) ?? val.toString();
    } else {
      display = formatVal(val);
    }
    return { ts, author: hist.authors[i] ?? '', value: display };
  });

  if (isFirst) {
    history.value = rows;

    // Aggregation
    const aggLimit = sampleLength.value < 200n ? sampleLength.value : 200n;
    const raw2  = await readContract<unknown>(fn, [props.x, props.y, 0n, aggLimit]);
    const hist2 = getRawHistory(raw2);

    if (props.isCategorical) {
      let aggCatNames = catNames;
      if (!aggCatNames) {
        aggCatNames = new Map();
        const unique2 = [...new Set(hist2.values.map(v => v.toString()))];
        await Promise.all(unique2.map(async catStr => {
          try {
            const name = await readContract<string>('getCategoryName', [props.x, props.y, BigInt(catStr)]);
            aggCatNames!.set(catStr, name || catStr);
          } catch { aggCatNames!.set(catStr, catStr); }
        }));
      }
      catAgg.value = aggregateCategorical(hist2.values, aggCatNames!);
    } else {
      numAgg.value = aggregateNumerical(hist2.values);
    }
  } else {
    history.value = [...history.value, ...rows];
  }

  histOffset.value += BigInt(hist.timestamps.length);
}

async function loadMore(): Promise<void> {
  loadingMore.value = true;
  try { await loadHistory(false); } finally { loadingMore.value = false; }
}

function openPropose(): void {
  createVotingPrefill.value = {
    x:             props.x,
    y:             props.y,
    isCategorical: props.isCategorical,
  };
  navigate('create-voting');
}

const themeName = () => props.themes.get(String(props.x))    ?? `T${props.x}`;
const stmtName  = () => props.statements.get(String(props.y)) ?? `S${props.y}`;

onMounted(async () => {
  errorKey.value = ''; errorMsg.value = '';
  try {
    const fn  = props.isCategorical ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
    const res = await readContract<unknown>(fn, [props.x, props.y]);
    const r   = res as Record<string, unknown> | unknown[];
    const organ       = (Array.isArray(r) ? r[0] : r['organ'])        as `0x${string}` | undefined;
    const sampleLen   = (Array.isArray(r) ? r[2] : r['sampleLength']) as bigint        | undefined;
    sampleLength.value = sampleLen ?? 0n;

    const tags = await readTags();
    const organLc  = organ?.toLowerCase();
    const organTag = organLc ? tags.find(tg => tg.organ?.toLowerCase() === organLc) : undefined;
    organLabel.value = organTag ? organTag.code : (organ ? shortAddr(organ) : '--');

    await loadHistory(true);
  } catch (e) {
    if (e instanceof Error) { errorMsg.value = e.message; }
    else                    { errorKey.value = 'matrix.loadError'; }
  }
});
</script>

<template>
  <div class="cell-detail">
    <div class="cell-detail__header">
      <button class="btn btn--ghost btn--sm" @click="emit('back')">{{ t('matrix.back') }}</button>
      <h3 class="cell-detail__title">{{ themeName() }} x {{ stmtName() }}</h3>
      <button class="btn btn--sm btn--outline" @click="openPropose">{{ t('matrix.propose') }}</button>
    </div>

    <p v-if="errorKey || errorMsg" class="cell-detail__error">{{ errorKey ? t(errorKey) : errorMsg }}</p>

    <div v-else>
      <p class="cell-detail__organ">
        <span class="cell-detail__organ-label">{{ t('matrix.organ') }}</span>
        <code class="cell-detail__organ-code">{{ organLabel || '...' }}</code>
      </p>

      <!-- Numerical aggregation -->
      <div v-if="!isCategorical && numAgg" class="cell-detail__agg">
        <p class="cell-detail__agg-stat">{{ t('matrix.mean') }}: <strong>{{ numAgg.mean.toFixed(decimals > 0 ? decimals : 2) }}</strong></p>
        <p class="cell-detail__agg-stat">{{ t('matrix.stdev') }}: <strong>+/-{{ numAgg.stdev.toFixed(decimals > 0 ? decimals : 2) }}</strong></p>
        <p class="cell-detail__agg-muted">{{ t('matrix.basedOn').replace('{n}', String(numAgg.count)) }}</p>
      </div>

      <!-- Categorical aggregation -->
      <div v-if="isCategorical && catAgg" class="cell-detail__agg">
        <p class="cell-detail__agg-stat">{{ t('matrix.mode') }}: <strong>{{ catAgg.mode }}</strong></p>
        <div class="cell-detail__bars">
          <div v-for="item in catAgg.distribution" :key="item.key" class="cell-detail__bar-row">
            <span class="cell-detail__bar-label" :title="item.key">{{ item.key }}</span>
            <div class="cell-detail__bar-track">
              <div class="cell-detail__bar-fill" :style="{ width: item.pct + '%' }"></div>
            </div>
            <span class="cell-detail__bar-pct">{{ item.pct }}%</span>
          </div>
        </div>
        <p class="cell-detail__agg-muted">{{ t('matrix.basedOn').replace('{n}', String(catAgg.count)) }}</p>
      </div>

      <!-- History table -->
      <table v-if="history.length > 0" class="cell-detail__history-table">
        <thead>
          <tr>
            <th>{{ t('matrix.historyTime') }}</th>
            <th>{{ t('matrix.historyAuthor') }}</th>
            <th>{{ t('matrix.historyValue') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in history" :key="i" class="cell-detail__history-row">
            <td class="cell-detail__history-ts">{{ formatTimestamp(row.ts) }}</td>
            <td class="cell-detail__history-author"><code>{{ shortAddr(row.author) }}</code></td>
            <td class="cell-detail__history-val">{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="sampleLength === 0n" class="cell-detail__empty">{{ t('matrix.noHistory') }}</p>

      <button
        v-if="histOffset < sampleLength"
        class="btn btn--ghost btn--sm"
        :disabled="loadingMore"
        @click="loadMore"
      >{{ t('matrix.loadMore') }}</button>
    </div>
  </div>
</template>
