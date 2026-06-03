import { useEffect, useState } from "react";
import CalendarHeatmap from "../components/CalendarHeatmap";
import EntryCard from "../components/EntryCard";
import TimelineChart from "../components/TimelineChart";
import { api } from "../lib/api";
import type { DailyStat, Entry, HeatmapDay, SummaryStats } from "../lib/types";
import { MOOD_EMOJIS } from "../lib/types";

function Delta({ value, unit }: { value: number | null; unit: string }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-medium ${positive ? "text-emerald-600" : "text-red-500"}`}
    >
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)} {unit} vs 7-day avg
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  delta,
  deltaUnit,
  accent,
  isEmpty,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  delta?: number | null;
  deltaUnit?: string;
  accent?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border p-4 text-center flex flex-col items-center gap-1 ${isEmpty ? "border-dashed border-gray-200" : "border-gray-200"}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-4xl mt-1 font-bold ${accent ?? "text-gray-800"} ${isEmpty ? "opacity-30" : ""}`}>
        {value}
      </p>
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
      {delta !== undefined && deltaUnit && <Delta value={delta ?? null} unit={deltaUnit} />}
    </div>
  );
}

export default function Dashboard() {
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.stats.daily(),
      api.stats.heatmap(),
      api.entries.list(),
      api.stats.summary(),
    ])
      .then(([d, h, e, s]) => {
        setDaily(d);
        setHeatmap(h);
        setRecent(e.slice(0, 5));
        setSummary(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading your pulse...
      </div>
    );
  }

  const s = summary;
  const hasToday = s && s.today_count > 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Your mood & energy at a glance
          </p>
        </div>
        {s && s.streak > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
            <p className="text-2xl">🔥</p>
            <p className="text-xs font-semibold text-amber-700">{s.streak}-day streak</p>
          </div>
        )}
      </div>

      {/* Today section */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          Today
          {!hasToday && (
            <span className="text-xs font-normal normal-case text-gray-300">— no entries yet</span>
          )}
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Today's Mood"
            value={s?.today_mood ? MOOD_EMOJIS[Math.round(s.today_mood)] : "—"}
            sub={s?.today_mood ? `${s.today_mood}/5` : "Log your first entry"}
            delta={s?.mood_vs_7d}
            deltaUnit="mood pts"
            isEmpty={!hasToday}
          />
          <StatCard
            label="Today's Energy"
            value={s?.today_energy ?? "—"}
            sub={s?.today_energy ? "out of 10" : "Log your first entry"}
            delta={s?.energy_vs_7d}
            deltaUnit="energy pts"
            accent="text-emerald-500"
            isEmpty={!hasToday}
          />
          <StatCard
            label="Entries Today"
            value={s?.today_count ?? 0}
            sub={s?.today_count === 0 ? "Time to log!" : "Keep it up"}
            accent="text-pulse-600"
          />
        </div>
      </div>

      {/* Historical baseline section */}
      {s && s.total_entries > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Your Baseline
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 text-center">
              <p className="text-xs text-indigo-400 uppercase tracking-wider">7-Day Mood</p>
              <p className="text-3xl font-bold text-indigo-700 mt-1">
                {s.baseline_7d_mood != null
                  ? `${s.baseline_7d_mood}`
                  : "—"}
              </p>
              <p className="text-xs text-indigo-400 mt-0.5">avg / 5</p>
            </div>
            <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4 text-center">
              <p className="text-xs text-emerald-500 uppercase tracking-wider">7-Day Energy</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">
                {s.baseline_7d_energy != null
                  ? `${s.baseline_7d_energy}`
                  : "—"}
              </p>
              <p className="text-xs text-emerald-400 mt-0.5">avg / 10</p>
            </div>
            <div className="bg-violet-50 rounded-xl border border-violet-100 p-4 text-center">
              <p className="text-xs text-violet-400 uppercase tracking-wider">30-Day Mood</p>
              <p className="text-3xl font-bold text-violet-700 mt-1">
                {s.baseline_30d_mood != null
                  ? `${s.baseline_30d_mood}`
                  : "—"}
              </p>
              <p className="text-xs text-violet-400 mt-0.5">avg / 5</p>
            </div>
            <div className="bg-sky-50 rounded-xl border border-sky-100 p-4 text-center">
              <p className="text-xs text-sky-400 uppercase tracking-wider">All-Time Energy</p>
              <p className="text-3xl font-bold text-sky-700 mt-1">
                {s.all_time_energy != null
                  ? `${s.all_time_energy}`
                  : "—"}
              </p>
              <p className="text-xs text-sky-400 mt-0.5">avg / 10 · {s.total_entries} entries</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimelineChart data={daily} title="Last 14 Days — Daily Averages" />
        <CalendarHeatmap data={heatmap} />
      </div>

      {/* Recent entries */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Recent Entries
        </h2>
        {recent.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No entries yet. Start by logging your first mood!
          </p>
        ) : (
          <div className="space-y-3">
            {recent.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
