import { ref, onMounted } from 'vue';
import { useAppState } from './useAppState';
import { readContract } from '../services/zaryaService';
import { readTags } from '../services/tagsService';
import type { NumericalAgg, CategoricalAgg } from '../types/matrix';
import { shortAddress as shortAddr, formatTimestamp } from './utils';

const HISTORY_PAGE = 20n;

interface CellDetailProps {
  x:             bigint;
  y:             bigint;
  decimals:      number;
  isCategorical: boolean;
  themes:        Map<string, string>;
  statements:    Map<string, string>;
}

export function useCellDetail(props: CellDetailProps) {
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

  function formatVal(val: bigint): string {
    if (props.isCategorical) return val.toString();
    if (props.decimals > 0) {
      const divisor = BigInt(10 ** props.decimals);
      const whole   = val / divisor;
      const frac    = val % divisor;
      return `${whole}.${String(frac).padStart(props.decimals, '0')}`;
    }
    return val.toString();
  }

  function aggregateNumerical(values: bigint[]): NumericalAgg {
    if (values.length === 0) return { mean: 0, stdev: 0, min: 0, max: 0, count: 0 };
    const nums = values.map(v =>
      props.decimals > 0 ? Number(v) / (10 ** props.decimals) : Number(v),
    );
    const n        = nums.length;
    const sum      = nums.reduce((a, b) => a + b, 0);
    const mean     = sum / n;
    const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    return { mean, stdev: Math.sqrt(variance), min: Math.min(...nums), max: Math.max(...nums), count: n };
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
      mode:         sorted[0]![0],
      distribution: sorted.map(([key, count]) => ({ key, count, pct: Math.round(count / total * 100) })),
      count:        total,
    };
  }

  function getRawHistory(raw: unknown): { timestamps: number[]; authors: string[]; values: bigint[] } {
    const r = raw as Record<string, unknown> | unknown[];
    return {
      timestamps: (Array.isArray(r) ? r[0] : r['timestamps']) as number[] ?? [],
      authors:    (Array.isArray(r) ? r[1] : r['authors'])    as string[] ?? [],
      values:     (Array.isArray(r) ? r[2] : r['values'])     as bigint[] ?? [],
    };
  }

  async function fetchCatNames(values: bigint[]): Promise<Map<string, string>> {
    const catNames = new Map<string, string>();
    const unique   = [...new Set(values.map(v => v.toString()))];
    await Promise.all(unique.map(async catStr => {
      try {
        const name = await readContract<string>('getCategoryName', [props.x, props.y, BigInt(catStr)]);
        catNames.set(catStr, name || catStr);
      } catch { catNames.set(catStr, catStr); }
    }));
    return catNames;
  }

  async function loadHistory(isFirst: boolean): Promise<void> {
    const fn   = props.isCategorical ? 'getCategoricalHistory' : 'getNumericalHistory';
    const raw  = await readContract<unknown>(fn, [props.x, props.y, histOffset.value, HISTORY_PAGE]);
    const hist = getRawHistory(raw);

    const catNames = props.isCategorical && hist.values.length > 0
      ? await fetchCatNames(hist.values)
      : undefined;

    const rows = hist.timestamps.map((ts, i) => {
      const val = hist.values[i] ?? 0n;
      const display = props.isCategorical
        ? (catNames?.get(val.toString()) ?? val.toString())
        : formatVal(val);
      return { ts, author: hist.authors[i] ?? '', value: display };
    });

    if (isFirst) {
      history.value = rows;

      const aggLimit = sampleLength.value < 200n ? sampleLength.value : 200n;
      const raw2  = await readContract<unknown>(fn, [props.x, props.y, 0n, aggLimit]);
      const hist2 = getRawHistory(raw2);

      if (props.isCategorical) {
        const aggCatNames = catNames ?? await fetchCatNames(hist2.values);
        catAgg.value = aggregateCategorical(hist2.values, aggCatNames);
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
    createVotingPrefill.value = { x: props.x, y: props.y, isCategorical: props.isCategorical };
    navigate('create-voting');
  }

  const themeName = () => props.themes.get(String(props.x))     ?? `T${props.x}`;
  const stmtName  = () => props.statements.get(String(props.y)) ?? `S${props.y}`;

  onMounted(async () => {
    errorKey.value = ''; errorMsg.value = '';
    try {
      const fn  = props.isCategorical ? 'getCategoricalCellInfo' : 'getNumericalCellInfo';
      const res = await readContract<unknown>(fn, [props.x, props.y]);
      const r   = res as Record<string, unknown> | unknown[];
      const organ     = (Array.isArray(r) ? r[0] : r['organ'])        as `0x${string}` | undefined;
      const sampleLen = (Array.isArray(r) ? r[2] : r['sampleLength']) as bigint        | undefined;
      sampleLength.value = sampleLen ?? 0n;

      const tags    = await readTags();
      const organLc = organ?.toLowerCase();
      const tag     = organLc ? tags.find(tg => tg.organ?.toLowerCase() === organLc) : undefined;
      organLabel.value = tag ? tag.code : (organ ? shortAddr(organ) : '--');

      await loadHistory(true);
    } catch (e) {
      if (e instanceof Error) { errorMsg.value = e.message; }
      else                    { errorKey.value = 'matrix.loadError'; }
    }
  });

  return {
    organLabel, numAgg, catAgg, history, sampleLength, histOffset,
    loadingMore, errorKey, errorMsg,
    shortAddr, formatTimestamp, loadMore, openPropose,
    themeName, stmtName,
  };
}
