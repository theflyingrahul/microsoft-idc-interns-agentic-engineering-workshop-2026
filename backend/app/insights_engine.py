"""
Correlation Insights Engine — all statistical logic lives here.

Computes:
  - Per-tag point-biserial correlations with mood/energy
  - OLS multiple regression to predict mood/energy from tags + hour-of-day
  - Time-series regression (daily averages + linear trend + 7-day rolling average)
  - Compound tag pair analysis
  - Human-readable insight cards with confidence scores

Minimum data requirement: 7 entries before any insight is surfaced.
All correlations are stated as associations, never causation.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np

from .models.entry import Entry

# ─── Constants ────────────────────────────────────────────────────────────────

MIN_ENTRIES_TOTAL = 7          # need at least this many entries overall
MIN_TAG_OCCURRENCES = 5        # need at least this many entries WITH a tag
CONFIDENCE_DISPLAY_THRESHOLD = 40  # don't show cards below 40% confidence


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _day_key(ts: datetime) -> str:
    return str(ts.date())


def _hour_bucket(hour: int) -> str:
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    return "evening"


def _pearson(x: list[float], y: list[float]) -> float:
    """Pearson correlation coefficient between two lists."""
    n = len(x)
    if n < 3:
        return 0.0
    xa = np.array(x, dtype=float)
    ya = np.array(y, dtype=float)
    if xa.std() == 0 or ya.std() == 0:
        return 0.0
    return float(np.corrcoef(xa, ya)[0, 1])


def _confidence_from_r_and_n(r: float, n: int) -> int:
    """
    Derive a 0-100 confidence score from correlation strength and sample size.
    Formula: uses Fisher z-transform standard error to compute rough % confidence.
    Caps at 95 to avoid implying certainty.
    """
    if n < MIN_TAG_OCCURRENCES:
        return 0
    # Fisher z-transform: SE = 1/sqrt(n-3)
    se = 1.0 / math.sqrt(max(n - 3, 1))
    # |r| weighted by inverse SE (larger n → smaller SE → higher confidence)
    raw = abs(r) * (1.0 - se)
    confidence = int(min(95, raw * 120))  # scale to 0-95 range
    return max(0, confidence)


# ─── Tag Correlations ─────────────────────────────────────────────────────────

def compute_tag_correlations(entries: list[Entry]) -> list[dict]:
    """
    For each tag that appears in the data, compute:
      - avg mood WITH and WITHOUT the tag
      - avg energy WITH and WITHOUT the tag
      - Pearson correlation (point-biserial) with mood and energy
      - confidence score
      - count of entries with the tag
    Returns sorted by abs(mood_delta) descending.
    """
    if len(entries) < MIN_ENTRIES_TOTAL:
        return []

    all_tags: set[str] = set()
    for e in entries:
        all_tags.update(e.tags)

    results = []
    for tag in sorted(all_tags):
        with_tag = [e for e in entries if tag in e.tags]
        without_tag = [e for e in entries if tag not in e.tags]

        n_with = len(with_tag)
        if n_with < MIN_TAG_OCCURRENCES or len(without_tag) < MIN_TAG_OCCURRENCES:
            continue

        avg_mood_with = float(np.mean([e.mood for e in with_tag]))
        avg_mood_without = float(np.mean([e.mood for e in without_tag]))
        avg_energy_with = float(np.mean([e.energy for e in with_tag]))
        avg_energy_without = float(np.mean([e.energy for e in without_tag]))

        # Point-biserial: binary tag × continuous outcome
        tag_binary = [1 if tag in e.tags else 0 for e in entries]
        mood_vals = [e.mood for e in entries]
        energy_vals = [e.energy for e in entries]

        mood_r = _pearson(tag_binary, mood_vals)
        energy_r = _pearson(tag_binary, energy_vals)

        mood_confidence = _confidence_from_r_and_n(mood_r, n_with)
        energy_confidence = _confidence_from_r_and_n(energy_r, n_with)

        results.append({
            "tag": tag,
            "count": n_with,
            "avg_mood_with": round(avg_mood_with, 2),
            "avg_mood_without": round(avg_mood_without, 2),
            "mood_delta": round(avg_mood_with - avg_mood_without, 2),
            "mood_r": round(mood_r, 3),
            "mood_confidence": mood_confidence,
            "avg_energy_with": round(avg_energy_with, 2),
            "avg_energy_without": round(avg_energy_without, 2),
            "energy_delta": round(avg_energy_with - avg_energy_without, 2),
            "energy_r": round(energy_r, 3),
            "energy_confidence": energy_confidence,
        })

    results.sort(key=lambda x: abs(x["mood_delta"]), reverse=True)
    return results


# ─── OLS Multiple Regression ──────────────────────────────────────────────────

def compute_multiple_regression(
    entries: list[Entry], target: str = "mood"
) -> Optional[dict]:
    """
    OLS regression: predict mood or energy from tag features + hour-of-day.
    β = (XᵀX)⁻¹ Xᵀy

    Features:
      - One binary column per tag that appears ≥ MIN_TAG_OCCURRENCES times
      - hour_of_day (0-23, continuous)

    Returns:
      - coefficients: [{feature, coef, abs_coef}]
      - intercept
      - r_squared
      - n (sample size)
    """
    if len(entries) < MIN_ENTRIES_TOTAL:
        return None

    assert target in ("mood", "energy"), "target must be 'mood' or 'energy'"

    # Determine eligible tag features
    tag_counts: dict[str, int] = defaultdict(int)
    for e in entries:
        for t in e.tags:
            tag_counts[t] += 1
    eligible_tags = sorted(t for t, c in tag_counts.items() if c >= MIN_TAG_OCCURRENCES)

    if not eligible_tags:
        return None

    features = eligible_tags + ["hour_of_day"]

    # Build design matrix X (n × p) and target vector y
    rows = []
    ys = []
    for e in entries:
        row = [1 if t in e.tags else 0 for t in eligible_tags]
        row.append(e.timestamp.hour / 23.0)  # normalise 0-1
        rows.append(row)
        ys.append(e.mood if target == "mood" else e.energy)

    X = np.array(rows, dtype=float)
    y = np.array(ys, dtype=float)

    # Add intercept column
    ones = np.ones((X.shape[0], 1))
    X_aug = np.hstack([ones, X])  # shape (n, p+1)

    try:
        # β = (XᵀX)⁻¹ Xᵀy — use lstsq for numerical stability
        beta, _, _, _ = np.linalg.lstsq(X_aug, y, rcond=None)
    except np.linalg.LinAlgError:
        return None

    intercept = float(beta[0])
    coefs = beta[1:]

    # R²
    y_pred = X_aug @ beta
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    coefficients = [
        {
            "feature": feat,
            "coef": round(float(c), 4),
            "abs_coef": round(abs(float(c)), 4),
        }
        for feat, c in zip(features, coefs)
    ]
    coefficients.sort(key=lambda x: x["abs_coef"], reverse=True)

    return {
        "target": target,
        "intercept": round(intercept, 4),
        "coefficients": coefficients,
        "r_squared": round(max(0.0, r_squared), 4),
        "n": len(entries),
        "features": features,
    }


# ─── Time-Series Regression ───────────────────────────────────────────────────

def compute_timeseries_regression(entries: list[Entry]) -> dict:
    """
    Computes:
      - daily_averages: [{ date, avg_mood, avg_energy, count }] for all days with data
      - trend_mood: [{ date, trend_mood }] — OLS linear trend over daily averages
      - trend_energy: [{ date, trend_energy }] — same for energy
      - rolling_mood: 7-day rolling average
      - rolling_energy: 7-day rolling average
      - mood_slope: mood trend direction (positive = improving over time)
      - energy_slope: energy trend direction
    """
    if len(entries) < MIN_ENTRIES_TOTAL:
        return {"daily_averages": [], "trend": [], "rolling": []}

    # Aggregate by day
    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        by_day[_day_key(e.timestamp)].append(e)

    sorted_days = sorted(by_day.keys())

    daily = []
    for day in sorted_days:
        day_entries = by_day[day]
        daily.append({
            "date": day,
            "avg_mood": round(float(np.mean([e.mood for e in day_entries])), 2),
            "avg_energy": round(float(np.mean([e.energy for e in day_entries])), 2),
            "count": len(day_entries),
        })

    n = len(daily)
    if n < 3:
        return {"daily_averages": daily, "trend": [], "rolling": []}

    x = np.arange(n, dtype=float)
    mood_vals = np.array([d["avg_mood"] for d in daily])
    energy_vals = np.array([d["avg_energy"] for d in daily])

    # OLS trend line for mood
    X_aug = np.column_stack([np.ones(n), x])
    beta_mood, _, _, _ = np.linalg.lstsq(X_aug, mood_vals, rcond=None)
    beta_energy, _, _, _ = np.linalg.lstsq(X_aug, energy_vals, rcond=None)

    trend_mood = [float(beta_mood[0] + beta_mood[1] * i) for i in x]
    trend_energy = [float(beta_energy[0] + beta_energy[1] * i) for i in x]

    # 7-day rolling average
    window = 7

    def rolling_avg(vals: np.ndarray) -> list[Optional[float]]:
        result: list[Optional[float]] = []
        for i in range(len(vals)):
            if i < window - 1:
                result.append(None)
            else:
                result.append(round(float(vals[i - window + 1: i + 1].mean()), 2))
        return result

    rolling_mood = rolling_avg(mood_vals)
    rolling_energy = rolling_avg(energy_vals)

    # Merge into a single list for easy frontend consumption
    combined = []
    for i, d in enumerate(daily):
        combined.append({
            "date": d["date"],
            "avg_mood": d["avg_mood"],
            "avg_energy": d["avg_energy"],
            "count": d["count"],
            "trend_mood": round(trend_mood[i], 3),
            "trend_energy": round(trend_energy[i], 3),
            "rolling_mood": rolling_mood[i],
            "rolling_energy": rolling_energy[i],
        })

    return {
        "series": combined,
        "mood_slope": round(float(beta_mood[1]), 5),   # +ve = improving
        "energy_slope": round(float(beta_energy[1]), 5),
        "n_days": n,
    }


# ─── Compound Tag Insights ────────────────────────────────────────────────────

def compute_compound_insights(entries: list[Entry]) -> list[dict]:
    """
    Find tag *pairs* that co-occur ≥ MIN_TAG_OCCURRENCES times and compare
    their combined avg mood/energy vs. the global average.
    Returns top 5 pairs by mood lift, sorted descending.
    """
    if len(entries) < MIN_ENTRIES_TOTAL:
        return []

    global_avg_mood = float(np.mean([e.mood for e in entries]))
    global_avg_energy = float(np.mean([e.energy for e in entries]))

    tag_set: set[str] = set()
    for e in entries:
        tag_set.update(e.tags)
    tags = sorted(tag_set)

    results = []
    for i, t1 in enumerate(tags):
        for t2 in tags[i + 1:]:
            combined = [e for e in entries if t1 in e.tags and t2 in e.tags]
            if len(combined) < MIN_TAG_OCCURRENCES:
                continue
            avg_mood = float(np.mean([e.mood for e in combined]))
            avg_energy = float(np.mean([e.energy for e in combined]))
            results.append({
                "tags": [t1, t2],
                "count": len(combined),
                "avg_mood": round(avg_mood, 2),
                "avg_energy": round(avg_energy, 2),
                "mood_lift": round(avg_mood - global_avg_mood, 2),
                "energy_lift": round(avg_energy - global_avg_energy, 2),
            })

    results.sort(key=lambda x: x["mood_lift"], reverse=True)
    return results[:5]


# ─── Insight Card Generator ───────────────────────────────────────────────────

def generate_insight_cards(entries: list[Entry]) -> list[dict]:
    """
    Produces human-readable insight cards from the statistical analysis.
    Each card has:
      - id: stable string identifier
      - icon: emoji
      - title: short headline
      - description: fuller, non-causal phrasing
      - confidence: 0-100
      - category: 'tag' | 'compound' | 'trend' | 'time'
    Only cards above CONFIDENCE_DISPLAY_THRESHOLD are included.
    """
    if len(entries) < MIN_ENTRIES_TOTAL:
        return []

    cards: list[dict] = []

    # ── Tag correlation cards ──────────────────────────────────────────────────
    correlations = compute_tag_correlations(entries)
    for corr in correlations:
        tag = corr["tag"]
        mood_delta = corr["mood_delta"]
        energy_delta = corr["energy_delta"]

        # Mood card
        if corr["mood_confidence"] >= CONFIDENCE_DISPLAY_THRESHOLD:
            direction = "higher" if mood_delta > 0 else "lower"
            icon = "🙂" if mood_delta > 0 else "😔"
            delta_str = f"{abs(mood_delta):.1f} pts"
            cards.append({
                "id": f"tag-mood-{tag}",
                "icon": icon,
                "title": f"{tag.title()} days correlate with {direction} mood",
                "description": (
                    f"On days tagged '{tag}', your mood averages "
                    f"{corr['avg_mood_with']:.1f}/5 — {delta_str} {direction} than "
                    f"days without it ({corr['avg_mood_without']:.1f}/5). "
                    f"Based on {corr['count']} logged entries."
                ),
                "confidence": corr["mood_confidence"],
                "category": "tag",
                "tag": tag,
                "metric": "mood",
                "delta": mood_delta,
            })

        # Energy card
        if corr["energy_confidence"] >= CONFIDENCE_DISPLAY_THRESHOLD:
            direction = "higher" if energy_delta > 0 else "lower"
            icon = "⚡" if energy_delta > 0 else "🪫"
            delta_str = f"{abs(energy_delta):.1f} pts"
            cards.append({
                "id": f"tag-energy-{tag}",
                "icon": icon,
                "title": f"{tag.title()} days correlate with {direction} energy",
                "description": (
                    f"On days tagged '{tag}', your energy averages "
                    f"{corr['avg_energy_with']:.1f}/10 — {delta_str} {direction} than "
                    f"days without it ({corr['avg_energy_without']:.1f}/10). "
                    f"Based on {corr['count']} logged entries."
                ),
                "confidence": corr["energy_confidence"],
                "category": "tag",
                "tag": tag,
                "metric": "energy",
                "delta": energy_delta,
            })

    # ── Compound tag cards ─────────────────────────────────────────────────────
    compounds = compute_compound_insights(entries)
    for c in compounds:
        if c["mood_lift"] > 0:
            tag_label = " + ".join(c["tags"])
            confidence = _confidence_from_r_and_n(c["mood_lift"] / 5.0, c["count"])
            if confidence >= CONFIDENCE_DISPLAY_THRESHOLD:
                cards.append({
                    "id": f"compound-{'_'.join(c['tags'])}",
                    "icon": "✨",
                    "title": f"Your {tag_label} combo correlates with peak mood",
                    "description": (
                        f"Days with both {c['tags'][0]} and {c['tags'][1]} show "
                        f"an average mood of {c['avg_mood']:.1f}/5 and energy of "
                        f"{c['avg_energy']:.1f}/10 — "
                        f"{c['mood_lift']:+.1f} pts mood above your overall average. "
                        f"Based on {c['count']} co-occurring entries."
                    ),
                    "confidence": min(confidence, 90),
                    "category": "compound",
                    "tags": c["tags"],
                    "metric": "mood",
                    "delta": c["mood_lift"],
                })

    # ── Trend card ─────────────────────────────────────────────────────────────
    ts = compute_timeseries_regression(entries)
    if ts.get("n_days", 0) >= 7:
        slope = ts["mood_slope"]
        if abs(slope) > 0.005:
            direction = "upward 📈" if slope > 0 else "downward 📉"
            icon = "📈" if slope > 0 else "📉"
            per_week = abs(slope * 7)
            confidence = min(80, int(abs(slope) * 10000))
            if confidence >= CONFIDENCE_DISPLAY_THRESHOLD:
                cards.append({
                    "id": "trend-mood",
                    "icon": icon,
                    "title": f"Your mood has been trending {direction}",
                    "description": (
                        f"Over the past {ts['n_days']} days your mood shows a "
                        f"{'positive' if slope > 0 else 'negative'} trend of about "
                        f"{per_week:.2f} pts per week. This is based on a linear "
                        f"regression of your daily averages."
                    ),
                    "confidence": confidence,
                    "category": "trend",
                    "metric": "mood",
                    "delta": slope,
                })

    # ── Time-of-day card ───────────────────────────────────────────────────────
    morning = [e for e in entries if e.timestamp.hour < 12]
    evening = [e for e in entries if e.timestamp.hour >= 17]
    if len(morning) >= MIN_TAG_OCCURRENCES and len(evening) >= MIN_TAG_OCCURRENCES:
        am_energy = float(np.mean([e.energy for e in morning]))
        pm_energy = float(np.mean([e.energy for e in evening]))
        delta = am_energy - pm_energy
        r = _pearson(
            [1 if e.timestamp.hour < 12 else 0 for e in morning + evening],
            [e.energy for e in morning + evening],
        )
        confidence = _confidence_from_r_and_n(r, len(morning))
        if confidence >= CONFIDENCE_DISPLAY_THRESHOLD:
            icon = "🌅" if delta > 0 else "🌙"
            time_label = "morning" if delta > 0 else "evening"
            cards.append({
                "id": "time-energy",
                "icon": icon,
                "title": f"Your energy is higher in the {time_label}",
                "description": (
                    f"Morning entries average {am_energy:.1f}/10 energy vs. "
                    f"{pm_energy:.1f}/10 in the evening. "
                    f"({len(morning)} morning, {len(evening)} evening entries logged.)"
                ),
                "confidence": confidence,
                "category": "time",
                "metric": "energy",
                "delta": delta,
            })

    # Sort by confidence descending
    cards.sort(key=lambda c: c["confidence"], reverse=True)
    return cards
