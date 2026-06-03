import { useState } from "react";
import type { InsightCard as InsightCardType } from "../lib/types";

const DISMISS_KEY = "pulse_dismissed_insights";
const SNOOZE_KEY = "pulse_snoozed_insights";

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function getSnoozed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

function dismiss(id: string) {
  const current = getDismissed();
  current.add(id);
  localStorage.setItem(DISMISS_KEY, JSON.stringify([...current]));
}

function snooze(id: string, days: number) {
  const current = getSnoozed();
  current[id] = Date.now() + days * 86400000;
  localStorage.setItem(SNOOZE_KEY, JSON.stringify(current));
}

function isSnoozed(id: string): boolean {
  const snoozed = getSnoozed();
  return !!snoozed[id] && snoozed[id] > Date.now();
}

function confidenceColor(conf: number): string {
  if (conf >= 75) return "bg-emerald-500";
  if (conf >= 50) return "bg-yellow-400";
  return "bg-orange-400";
}

function confidenceLabel(conf: number): string {
  if (conf >= 75) return "High confidence";
  if (conf >= 50) return "Moderate confidence";
  return "Low confidence";
}

interface Props {
  card: InsightCardType;
  onDismiss?: (id: string) => void;
}

export default function InsightCard({ card, onDismiss }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDismiss = () => {
    dismiss(card.id);
    onDismiss?.(card.id);
    setMenuOpen(false);
  };

  const handleSnooze = (days: number) => {
    snooze(card.id, days);
    onDismiss?.(card.id);
    setMenuOpen(false);
  };

  const deltaPositive = card.delta > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow relative">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl flex-shrink-0 mt-0.5">{card.icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 leading-snug">
              {card.title}
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {card.description}
            </p>
          </div>
        </div>

        {/* Actions menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none cursor-pointer"
            title="Options"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[140px]">
              <button
                onClick={() => handleSnooze(7)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                😴 Snooze 1 week
              </button>
              <button
                onClick={() => handleSnooze(30)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                📅 Snooze 1 month
              </button>
              <button
                onClick={handleDismiss}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 cursor-pointer"
              >
                ✕ Dismiss
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        {/* Delta badge */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            deltaPositive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {deltaPositive ? "+" : ""}
          {card.delta.toFixed(1)} {card.metric === "mood" ? "mood pts" : "energy pts"}
        </span>

        {/* Confidence bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {confidenceLabel(card.confidence)}
          </span>
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${confidenceColor(card.confidence)}`}
              style={{ width: `${card.confidence}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 w-8">{card.confidence}%</span>
        </div>
      </div>
    </div>
  );
}

// Utility to filter out dismissed/snoozed cards
export { getDismissed, isSnoozed };
