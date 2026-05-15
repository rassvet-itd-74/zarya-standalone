export type MatrixMode = 'numerical' | 'categorical';

export interface NumericalAgg {
  mean: number;
  stdev: number;
  min: number;
  max: number;
  count: number;
}

export interface CategoricalAgg {
  mode: string;
  distribution: Array<{ key: string; count: number; pct: number }>;
  count: number;
}

export interface CellDetailContext {
  x: bigint;
  y: bigint;
  decimals: number;
  isCategorical: boolean;
}
