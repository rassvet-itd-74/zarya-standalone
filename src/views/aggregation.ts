/**
 * Pure off-chain aggregation helpers — no side effects, no DOM.
 * Used by matrix.ts cell-detail and any future view that needs stats.
 */

export interface NumericalAgg {
  mean:  number;
  stdev: number;
  min:   number;
  max:   number;
  count: number;
}

export interface CategoricalAgg {
  mode:         string;
  distribution: Array<{ key: string; count: number; pct: number }>;
  count:        number;
}

/**
 * Aggregate a numerical sample.
 * @param rawValues  Raw uint values as returned by the contract (bigint[]).
 * @param decimals   Fixed-point decimals to divide by (0 = integer).
 */
export function aggregateNumerical(rawValues: bigint[], decimals: number): NumericalAgg {
  if (rawValues.length === 0) {
    return { mean: 0, stdev: 0, min: 0, max: 0, count: 0 };
  }
  const divisor = decimals > 0 ? Number(BigInt(10 ** decimals)) : 1;
  const nums    = rawValues.map(v => Number(v) / divisor);
  const count   = nums.length;
  const mean    = nums.reduce((a, b) => a + b, 0) / count;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  const stdev   = Math.sqrt(variance);
  const min     = Math.min(...nums);
  const max     = Math.max(...nums);
  return { mean, stdev, min, max, count };
}

/**
 * Aggregate a categorical sample.
 * @param rawValues  Raw uint category values as returned by the contract (bigint[]).
 * @param nameMap    Optional map from category key string to human-readable name.
 */
export function aggregateCategorical(
  rawValues: bigint[],
  nameMap?: Map<string, string>,
): CategoricalAgg {
  if (rawValues.length === 0) {
    return { mode: '', distribution: [], count: 0 };
  }
  const freq = new Map<string, number>();
  for (const v of rawValues) {
    const k = v.toString();
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const total = rawValues.length;
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const mode   = nameMap?.get(sorted[0][0]) ?? sorted[0][0];
  const distribution = sorted.map(([key, count]) => ({
    key:   nameMap?.get(key) ?? key,
    count,
    pct:   Math.round((count / total) * 100),
  }));
  return { mode, distribution, count: total };
}
