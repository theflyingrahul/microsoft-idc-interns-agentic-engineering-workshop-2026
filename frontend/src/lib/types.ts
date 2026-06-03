export interface Entry {
  id: string;
  mood: number;
  energy: number;
  note: string | null;
  tags: string[];
  timestamp: string;
}

export interface EntryCreate {
  mood: number;
  energy: number;
  note?: string;
  tags: string[];
}

export interface DailyStat {
  date: string;
  avg_mood: number | null;
  avg_energy: number | null;
  count: number;
}

export interface WeeklyStat {
  week_start: string;
  avg_mood: number | null;
  avg_energy: number | null;
  count: number;
}

export interface HeatmapDay {
  date: string;
  avg_mood: number | null;
  count: number;
}

export interface SummaryStats {
  today_mood: number | null;
  today_energy: number | null;
  today_count: number;
  baseline_7d_mood: number | null;
  baseline_7d_energy: number | null;
  baseline_30d_mood: number | null;
  baseline_30d_energy: number | null;
  mood_vs_7d: number | null;
  energy_vs_7d: number | null;
  streak: number;
  all_time_mood: number | null;
  all_time_energy: number | null;
  total_entries: number;
}

export interface TagsResponse {
  predefined: string[];
  custom: string[];
}

// ── Insights types ─────────────────────────────────────────────────────────

export interface InsightCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  confidence: number; // 0-100
  category: "tag" | "compound" | "trend" | "time";
  metric: "mood" | "energy";
  delta: number;
  tag?: string;
  tags?: string[];
}

export interface TagCorrelation {
  tag: string;
  count: number;
  avg_mood_with: number;
  avg_mood_without: number;
  mood_delta: number;
  mood_r: number;
  mood_confidence: number;
  avg_energy_with: number;
  avg_energy_without: number;
  energy_delta: number;
  energy_r: number;
  energy_confidence: number;
}

export interface RegressionCoefficient {
  feature: string;
  coef: number;
  abs_coef: number;
}

export interface RegressionResult {
  target: string;
  intercept: number;
  coefficients: RegressionCoefficient[];
  r_squared: number;
  n: number;
  features: string[];
}

export interface TimeseriesPoint {
  date: string;
  avg_mood: number;
  avg_energy: number;
  count: number;
  trend_mood: number;
  trend_energy: number;
  rolling_mood: number | null;
  rolling_energy: number | null;
}

export interface TimeseriesResult {
  series: TimeseriesPoint[];
  mood_slope: number;
  energy_slope: number;
  n_days: number;
}

export const MOOD_EMOJIS: Record<number, string> = {
  1: "😢",
  2: "😕",
  3: "😐",
  4: "🙂",
  5: "😄",
};

export const MOOD_LABELS: Record<number, string> = {
  1: "Awful",
  2: "Bad",
  3: "Okay",
  4: "Good",
  5: "Great",
};
