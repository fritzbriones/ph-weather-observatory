export interface City {
  city: string;
  island: 'Luzon' | 'Visayas' | 'Mindanao' | string;
  lat: number;
  lon: number;
}

export interface CitySummary {
  city: string;
  oof_hours: number;
  oof_days: number;
  brier_A: number;
  logloss_A: number;
  brier_B: number;
  logloss_B: number;
  brier_C: number;
  logloss_C: number;
  delta_C_minus_B: number;
  delta_C_minus_A: number;
}

export interface ModelComparison {
  comparison: string;
  macro_mean_daily_brier_difference: number;
  ci_low: number;
  ci_high: number;
  bootstrap_reps: number;
  resampling_unit: string;
}

export interface IslandComparison {
  island: string;
  comparison: string;
  island_macro_mean_daily_brier_diff: number;
  ci_low: number;
  ci_high: number;
  cities: number;
  days: number;
}

/* V3 city cards: frozen reliability-bin types (src/data/reliability-bins.json) */
export interface ReliabilityBin {
  range: string;
  n: number;
  observed_freq: number;
}

export interface ReliabilityCity {
  n_hours: number;
  bin_hours: number;
  hourly_wet_rate: number;
  mean_prob_pct: number;
  hourly_brier: number;
  base_rate_brier: number;
  bins: ReliabilityBin[];
}

export interface ReliabilityBins {
  meta: Record<string, unknown>;
  cities: Record<string, ReliabilityCity>;
}
