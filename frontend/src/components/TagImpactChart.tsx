import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TagCorrelation } from "../lib/types";

interface Props {
  data: TagCorrelation[];
}

type Metric = "mood" | "energy";

const COLORS = {
  positive: "#10b981",
  negative: "#f43f5e",
  with: "#6366f1",
  without: "#e2e8f0",
};

function CustomTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const d: TagCorrelation = payload[0]?.payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">#{label}</p>
      {metric === "mood" ? (
        <>
          <p className="text-indigo-600">With tag: {d.avg_mood_with.toFixed(2)}/5</p>
          <p className="text-gray-400">Without: {d.avg_mood_without.toFixed(2)}/5</p>
          <p className={`font-medium mt-1 ${d.mood_delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            Δ {d.mood_delta > 0 ? "+" : ""}{d.mood_delta.toFixed(2)} pts
          </p>
          <p className="text-gray-400 mt-1">r = {d.mood_r.toFixed(3)} · {d.mood_confidence}% conf</p>
        </>
      ) : (
        <>
          <p className="text-indigo-600">With tag: {d.avg_energy_with.toFixed(2)}/10</p>
          <p className="text-gray-400">Without: {d.avg_energy_without.toFixed(2)}/10</p>
          <p className={`font-medium mt-1 ${d.energy_delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            Δ {d.energy_delta > 0 ? "+" : ""}{d.energy_delta.toFixed(2)} pts
          </p>
          <p className="text-gray-400 mt-1">r = {d.energy_r.toFixed(3)} · {d.energy_confidence}% conf</p>
        </>
      )}
      <p className="text-gray-400 mt-1">{d.count} entries</p>
    </div>
  );
}

export default function TagImpactChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>("mood");

  // Sort by absolute delta, desc
  const sorted = [...data].sort((a, b) =>
    Math.abs(b[metric === "mood" ? "mood_delta" : "energy_delta"]) -
    Math.abs(a[metric === "mood" ? "mood_delta" : "energy_delta"])
  );

  // Build grouped bar data: avg_with vs avg_without
  const chartData = sorted.map((d) => ({
    ...d,
    name: d.tag,
    with: metric === "mood" ? d.avg_mood_with : d.avg_energy_with,
    without: metric === "mood" ? d.avg_mood_without : d.avg_energy_without,
    delta: metric === "mood" ? d.mood_delta : d.energy_delta,
  }));

  const yMax = metric === "mood" ? 5 : 10;
  const yLabel = metric === "mood" ? "Mood (1-5)" : "Energy (1-10)";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Tag Impact on {metric === "mood" ? "Mood" : "Energy"}</h3>
          <p className="text-xs text-gray-400 mt-0.5">Average score with vs. without each tag</p>
        </div>
        <div className="flex gap-1">
          {(["mood", "energy"] as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                metric === m
                  ? "bg-pulse-100 text-pulse-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {m === "mood" ? "😊 Mood" : "⚡ Energy"}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            width={30}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "#9ca3af", dx: -4 }}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
          <Bar dataKey="without" name="Without tag" fill={COLORS.without} radius={[3, 3, 0, 0]} />
          <Bar dataKey="with" name="With tag" radius={[3, 3, 0, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.delta >= 0 ? COLORS.positive : COLORS.negative} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Green = positive association · Red = negative association · Correlations, not causation
      </p>
    </div>
  );
}
