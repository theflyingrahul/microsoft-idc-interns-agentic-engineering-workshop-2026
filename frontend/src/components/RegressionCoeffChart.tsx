import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RegressionResult } from "../lib/types";

interface Props {
  mood: RegressionResult | null;
  energy: RegressionResult | null;
}

type Target = "mood" | "energy";

function rSquaredLabel(r2: number): { label: string; color: string } {
  if (r2 >= 0.7) return { label: "Strong fit", color: "text-emerald-600" };
  if (r2 >= 0.4) return { label: "Moderate fit", color: "text-yellow-600" };
  return { label: "Weak fit", color: "text-orange-500" };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const coef = payload[0]?.value as number;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className={coef >= 0 ? "text-emerald-600" : "text-red-500"}>
        Coefficient: {coef > 0 ? "+" : ""}{coef.toFixed(4)}
      </p>
      <p className="text-gray-400 mt-1 text-[10px]">
        {coef > 0
          ? `↑ Associated with higher ${label === "hour_of_day" ? "outcome" : "score"}`
          : `↓ Associated with lower ${label === "hour_of_day" ? "outcome" : "score"}`}
      </p>
    </div>
  );
}

export default function RegressionCoeffChart({ mood, energy }: Props) {
  const [target, setTarget] = useState<Target>("mood");
  const result = target === "mood" ? mood : energy;

  if (!result) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          What Predicts Your {target === "mood" ? "Mood" : "Energy"}?
        </h3>
        <p className="text-gray-400 text-sm">Not enough data for regression analysis yet.</p>
      </div>
    );
  }

  const { label: fitLabel, color: fitColor } = rSquaredLabel(result.r_squared);

  const chartData = result.coefficients.map((c) => ({
    name: c.feature === "hour_of_day" ? "time of day" : c.feature,
    coef: c.coef,
    abs_coef: c.abs_coef,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            What Predicts Your {target === "mood" ? "Mood" : "Energy"}?
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">OLS regression coefficients — feature influence on outcome</p>
        </div>
        <div className="flex gap-1">
          {(["mood", "energy"] as Target[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                target === t
                  ? "bg-pulse-100 text-pulse-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {t === "mood" ? "😊 Mood" : "⚡ Energy"}
            </button>
          ))}
        </div>
      </div>

      {/* R² badge */}
      <div className="flex items-center gap-3 mb-4 p-2.5 bg-gray-50 rounded-lg">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Model R²</p>
          <p className="text-2xl font-bold text-gray-800">{(result.r_squared * 100).toFixed(1)}%</p>
        </div>
        <div className="border-l border-gray-200 pl-3">
          <p className={`text-xs font-semibold ${fitColor}`}>{fitLabel}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            These features explain {(result.r_squared * 100).toFixed(0)}% of variance
            in your {target} scores (n={result.n})
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 70 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#374151" }}
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="coef" name="Coefficient" radius={[0, 3, 3, 0]}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={d.coef >= 0 ? "#10b981" : "#f43f5e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        Green = positively associated · Red = negatively associated · Based on OLS regression, not causal inference
      </p>
    </div>
  );
}
