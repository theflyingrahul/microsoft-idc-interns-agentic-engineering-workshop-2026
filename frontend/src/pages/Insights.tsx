import { useEffect, useState } from "react";
import InsightCard, { getDismissed, isSnoozed } from "../components/InsightCard";
import RegressionCoeffChart from "../components/RegressionCoeffChart";
import TagImpactChart from "../components/TagImpactChart";
import TrendlineChart from "../components/TrendlineChart";
import { api } from "../lib/api";
import type {
  InsightCard as InsightCardType,
  RegressionResult,
  TagCorrelation,
  TimeseriesResult,
} from "../lib/types";

export default function Insights() {
  const [cards, setCards] = useState<InsightCardType[]>([]);
  const [correlations, setCorrelations] = useState<TagCorrelation[]>([]);
  const [regressionMood, setRegressionMood] = useState<RegressionResult | null>(null);
  const [regressionEnergy, setRegressionEnergy] = useState<RegressionResult | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.insights.cards(),
      api.insights.correlations(),
      api.insights.regression("mood"),
      api.insights.regression("energy"),
      api.insights.timeseries(),
    ])
      .then(([c, corr, regM, regE, ts]) => {
        // Filter dismissed / snoozed cards client-side
        const dismissed = getDismissed();
        const visible = c.filter(
          (card) => !dismissed.has(card.id) && !isSnoozed(card.id)
        );
        setCards(visible);
        setCorrelations(corr);
        // Handle regression endpoint returning error object when insufficient data
        setRegressionMood("error" in regM ? null : regM);
        setRegressionEnergy("error" in regE ? null : regE);
        setTimeseries(ts);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Analysing your patterns...
      </div>
    );
  }

  const positiveCards = cards.filter((c) => c.delta > 0);
  const negativeCards = cards.filter((c) => c.delta <= 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
        <p className="text-sm text-gray-500 mt-1">
          Patterns discovered from your logged data — correlations, not causation.
        </p>
      </div>

      {/* ── Insight Cards ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span>✨</span> Your Insights
          {cards.length > 0 && (
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {cards.length} active
            </span>
          )}
        </h2>

        {cards.length === 0 ? (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm text-gray-500">
              No insights yet — keep logging daily and patterns will emerge!
            </p>
            <p className="text-xs text-gray-400 mt-1">
              We need at least 7 entries and 5 uses of a tag to surface meaningful correlations.
            </p>
          </div>
        ) : (
          <>
            {positiveCards.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider mb-2">
                  🟢 Positive associations
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {positiveCards.map((card) => (
                    <InsightCard key={card.id} card={card} onDismiss={handleDismiss} />
                  ))}
                </div>
              </div>
            )}
            {negativeCards.length > 0 && (
              <div>
                <p className="text-xs text-red-500 font-medium uppercase tracking-wider mb-2">
                  🔴 Negative associations
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {negativeCards.map((card) => (
                    <InsightCard key={card.id} card={card} onDismiss={handleDismiss} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Tag Impact Chart ───────────────────────────────────────────────── */}
      {correlations.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span>🏷️</span> Tag Impact on Mood & Energy
          </h2>
          <TagImpactChart data={correlations} />
        </section>
      )}

      {/* ── Regression ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <span>📐</span> What Predicts Your Scores?
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Ordinary Least Squares regression — coefficient magnitude indicates relative importance.
          R² measures how much variance in your scores these features explain.
        </p>
        <RegressionCoeffChart mood={regressionMood} energy={regressionEnergy} />
      </section>

      {/* ── Time Series ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-1 flex items-center gap-2">
          <span>📈</span> Trend Over Time
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          Daily averages with a 7-day rolling average and OLS linear trend line.
          The trend line shows your overall trajectory.
        </p>
        <TrendlineChart data={timeseries} />
      </section>

      {/* ── Transparency note ─────────────────────────────────────────────── */}
      <section className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-800 mb-1">🔬 About these insights</h3>
        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
          <li>Correlations show associations, not cause-and-effect.</li>
          <li>Insights require at least 7 entries total and 5 uses of a tag.</li>
          <li>Confidence scores reflect sample size and correlation strength (not certainty).</li>
          <li>OLS regression is computed fresh from your data every time you visit this page.</li>
          <li>You can dismiss or snooze any card — your preferences are stored locally.</li>
        </ul>
      </section>
    </div>
  );
}
