import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesResult } from "../lib/types";

interface Props {
  data: TimeseriesResult | null;
}

type Metric = "mood" | "energy";

function slopeDescription(slope: number, metric: Metric): string {
  const perWeek = Math.abs(slope * 7);
  const dir = slope > 0 ? "improving" : "declining";
  const unit = metric === "mood" ? "mood points" : "energy points";
  if (Math.abs(slope) < 0.005) return `Your ${metric} is stable over this period.`;
  return `Your ${metric} is ${dir} by ~${perWeek.toFixed(2)} ${unit} per week.`;
}

function CustomTooltip({ active, payload, label, metric }: any) {
  if (!active || !payload?.length) return null;
  const byKey: Record<string, number | null> = {};
  for (const p of payload) byKey[p.dataKey] = p.value;
  const suffix = metric === "mood" ? "/5" : "/10";
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs min-w-[160px]">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {byKey[`avg_${metric}`] != null && (
        <p className="text-gray-600">Actual: {Number(byKey[`avg_${metric}`]).toFixed(2)}{suffix}</p>
      )}
      {byKey[`rolling_${metric}`] != null && (
        <p className="text-blue-500">7-day avg: {Number(byKey[`rolling_${metric}`]).toFixed(2)}{suffix}</p>
      )}
      {byKey[`trend_${metric}`] != null && (
        <p className="text-orange-400">Trend: {Number(byKey[`trend_${metric}`]).toFixed(2)}{suffix}</p>
      )}
    </div>
  );
}

export default function TrendlineChart({ data }: Props) {
  const [metric, setMetric] = useState<Metric>("mood");

  if (!data || data.series.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Mood & Energy Trend</h3>
        <p className="text-gray-400 text-sm">Not enough data for time-series analysis yet.</p>
      </div>
    );
  }

  const slope = metric === "mood" ? data.mood_slope : data.energy_slope;
  const yMax = metric === "mood" ? 5 : 10;

  // Format date labels — show every ~7 days to avoid clutter
  const formatted = data.series.map((d, i) => ({
    ...d,
    label:
      i === 0 || i === data.series.length - 1 || i % 7 === 0
        ? new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "",
  }));

  const trendColor = slope >= 0 ? "#f97316" : "#f43f5e";
  const slopeArrow = slope >= 0 ? "↑" : "↓";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            {metric === "mood" ? "Mood" : "Energy"} Trend Over Time
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {slopeArrow}{" "}
            <span className={slope >= 0 ? "text-emerald-600" : "text-red-500"}>
              {slopeDescription(slope, metric)}
            </span>
          </p>
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

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={formatted} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            interval={0}
          />
          <YAxis
            domain={[0, yMax]}
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            width={28}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

          {/* Actual daily average — thin, semi-transparent */}
          <Line
            type="monotone"
            dataKey={`avg_${metric}`}
            stroke="#94a3b8"
            strokeWidth={1.5}
            dot={false}
            name="Daily avg"
            connectNulls
          />

          {/* 7-day rolling average — solid blue */}
          <Line
            type="monotone"
            dataKey={`rolling_${metric}`}
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={false}
            name="7-day rolling avg"
            connectNulls
          />

          {/* OLS linear trend line — dashed orange/red */}
          <Line
            type="monotone"
            dataKey={`trend_${metric}`}
            stroke={trendColor}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="Linear trend"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400 justify-center">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-px bg-slate-400"></span> Daily avg</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-indigo-500"></span> 7-day rolling avg</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-px border-t-2 border-dashed border-orange-400"></span> OLS trend</span>
      </div>
    </div>
  );
}
