"""
Chat route — conversational AI assistant powered by GitHub Models.

The assistant receives the user's full computed insights as system context so it can
answer natural-language questions about mood/energy patterns without the user
needing to explain their data.

Required environment variable:
    GITHUB_TOKEN  — a GitHub personal access token with models:read permission.
                    GitHub Models is free for all GitHub users.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

from ..insights_engine import (
    compute_compound_insights,
    compute_multiple_regression,
    compute_tag_correlations,
    compute_timeseries_regression,
    generate_insight_cards,
)
from ..storage import list_entries

router = APIRouter()

GITHUB_MODELS_BASE = "https://models.inference.ai.azure.com"
MODEL = "gpt-4o-mini"


def _get_client() -> OpenAI:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise HTTPException(
            status_code=503,
            detail="GITHUB_TOKEN environment variable is not set. "
                   "Set it to a GitHub PAT with models:read permission.",
        )
    return OpenAI(base_url=GITHUB_MODELS_BASE, api_key=token)


def _build_system_prompt() -> str:
    """
    Build a comprehensive system prompt injecting the user's full statistical context.
    Called fresh for every request so the assistant always has current data.
    Includes: summary stats, all insight cards (with descriptions), all tag correlations,
    compound tag combos, full regression output, time-series trend, and recent daily data.
    """
    entries = list_entries()

    if not entries:
        return (
            "You are Pulse Assistant, a friendly AI built into the Pulse mood & "
            "energy tracker. The user has not logged any entries yet. Encourage them "
            "to start logging and explain what kinds of insights will become available."
        )

    # ── Dashboard summary stats ────────────────────────────────────────────────
    today = datetime.now(timezone.utc).date()
    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        by_day[str(e.timestamp.date())].append(e)

    today_entries = by_day.get(str(today), [])
    today_mood = round(sum(e.mood for e in today_entries) / len(today_entries), 2) if today_entries else None
    today_energy = round(sum(e.energy for e in today_entries) / len(today_entries), 2) if today_entries else None

    last_7 = [e for e in entries if today - timedelta(days=7) <= e.timestamp.date() < today]
    last_30 = [e for e in entries if today - timedelta(days=30) <= e.timestamp.date() < today]

    def avg(lst, attr):
        return round(sum(getattr(e, attr) for e in lst) / len(lst), 2) if lst else None

    b7_mood = avg(last_7, "mood")
    b7_energy = avg(last_7, "energy")
    b30_mood = avg(last_30, "mood")
    b30_energy = avg(last_30, "energy")
    all_mood = avg(entries, "mood")
    all_energy = avg(entries, "energy")

    streak = 0
    check = today if today_entries else today - timedelta(days=1)
    while str(check) in by_day and by_day[str(check)]:
        streak += 1
        check -= timedelta(days=1)

    summary_block = f"""  Today's mood: {today_mood if today_mood is not None else 'not logged yet'}/5
  Today's energy: {today_energy if today_energy is not None else 'not logged yet'}/10
  Today's entries: {len(today_entries)}
  7-day avg mood: {b7_mood}/5, 7-day avg energy: {b7_energy}/10
  30-day avg mood: {b30_mood}/5, 30-day avg energy: {b30_energy}/10
  All-time avg mood: {all_mood}/5, all-time avg energy: {all_energy}/10
  Total entries ever: {len(entries)}
  Date range: {entries[-1].timestamp.date()} → {entries[0].timestamp.date()}
  Current logging streak: {streak} consecutive day(s)"""

    # ── Insight cards (full text + numbers) ───────────────────────────────────
    cards = generate_insight_cards(entries)
    card_lines = []
    for c in cards:
        card_lines.append(
            f"  [{c['confidence']}% confidence | {c['category']} | {c['metric']} Δ={c['delta']:+.2f}]\n"
            f"  TITLE: {c['title']}\n"
            f"  DETAIL: {c['description']}"
        )
    cards_block = "\n\n".join(card_lines) if card_lines else "  No insight cards yet (need more data)."

    # ── Tag correlations (ALL tags, full numbers) ──────────────────────────────
    correlations = compute_tag_correlations(entries)
    corr_lines = []
    for c in sorted(correlations, key=lambda x: abs(x["mood_delta"]), reverse=True):
        corr_lines.append(
            f"  #{c['tag']} (n={c['count']} entries with tag):\n"
            f"    Mood:   avg WITH={c['avg_mood_with']:.2f}/5,  WITHOUT={c['avg_mood_without']:.2f}/5,  Δ={c['mood_delta']:+.2f},  r={c['mood_r']:+.3f},  confidence={c['mood_confidence']}%\n"
            f"    Energy: avg WITH={c['avg_energy_with']:.2f}/10, WITHOUT={c['avg_energy_without']:.2f}/10, Δ={c['energy_delta']:+.2f}, r={c['energy_r']:+.3f}, confidence={c['energy_confidence']}%"
        )
    corr_block = "\n".join(corr_lines) if corr_lines else "  Not enough data yet."

    # ── Compound tag pairs ─────────────────────────────────────────────────────
    compounds = compute_compound_insights(entries)
    compound_lines = []
    for c in compounds:
        compound_lines.append(
            f"  {' + '.join(c['tags'])} (n={c['count']}): avg mood={c['avg_mood']:.2f}/5, avg energy={c['avg_energy']:.2f}/10, mood lift={c['mood_lift']:+.2f}, energy lift={c['energy_lift']:+.2f}"
        )
    compound_block = "\n".join(compound_lines) if compound_lines else "  Not enough co-occurrences."

    # ── OLS Regression (ALL coefficients) ─────────────────────────────────────
    def reg_block(reg: Optional[dict], target: str) -> str:
        if not reg:
            return f"  Not enough data for {target} regression."
        coef_lines = "\n".join(
            f"    {c['feature']}: {c['coef']:+.4f} (|coef|={c['abs_coef']:.4f})"
            for c in reg["coefficients"]
        )
        return (
            f"  Target: {target}\n"
            f"  R² = {reg['r_squared']:.4f} ({reg['r_squared']*100:.1f}% of variance explained)\n"
            f"  Sample size: {reg['n']} entries\n"
            f"  Intercept: {reg['intercept']:+.4f}\n"
            f"  All coefficients (sorted by importance):\n{coef_lines}"
        )

    reg_mood = compute_multiple_regression(entries, "mood")
    reg_energy = compute_multiple_regression(entries, "energy")

    # ── Time-series (recent 14 days of daily values + trend) ──────────────────
    ts = compute_timeseries_regression(entries)
    ts_lines_list = []
    if ts.get("series"):
        recent_series = ts["series"][-14:]  # last 14 days with data
        ts_lines_list.append("  Recent daily averages (last 14 days with entries):")
        for d in recent_series:
            rolling_m = f"{d['rolling_mood']:.2f}" if d["rolling_mood"] is not None else "N/A"
            rolling_e = f"{d['rolling_energy']:.2f}" if d["rolling_energy"] is not None else "N/A"
            ts_lines_list.append(
                f"    {d['date']}: mood={d['avg_mood']:.2f}/5 (trend={d['trend_mood']:.2f}, 7d-roll={rolling_m}), "
                f"energy={d['avg_energy']:.2f}/10 (trend={d['trend_energy']:.2f}, 7d-roll={rolling_e})"
            )
        ts_lines_list.append(
            f"  Mood slope: {ts['mood_slope']:+.5f} pts/day ({'improving' if ts['mood_slope'] > 0 else 'declining'})"
        )
        ts_lines_list.append(
            f"  Energy slope: {ts['energy_slope']:+.5f} pts/day ({'improving' if ts['energy_slope'] > 0 else 'declining'})"
        )
        ts_lines_list.append(f"  Days with data: {ts['n_days']}")
    else:
        ts_lines_list.append("  Not enough data for time-series analysis.")
    ts_block = "\n".join(ts_lines_list)

    prompt = f"""You are Pulse Assistant — a friendly, precise AI built into the Pulse mood & energy tracker.
You have been given the user's COMPLETE statistical report below. Use it to answer any question accurately with exact numbers.

RULES:
- Always say "correlates with" or "is associated with" — NEVER "causes".
- Write in plain, conversational text only. No markdown. No bullet points. No asterisks, hashes, or dashes used as formatting.
- Keep every response under 60 words. If more detail is needed, the user will ask.
- Use short, direct sentences as if texting a friend.
- Quote exact numbers when relevant (e.g. "your mood with exercise averages 4.2 vs 3.1 without it").
- Frame observations as patterns, not prescriptions.
- If asked about something not in the data, say so in one sentence.

======= COMPLETE USER REPORT =======

--- SUMMARY STATS ---
{summary_block}

--- INSIGHT CARDS (auto-generated, with confidence) ---
{cards_block}

--- TAG CORRELATIONS (all tags, full numbers) ---
{corr_block}

--- BEST TAG COMBINATIONS (compound pairs) ---
{compound_block}

--- OLS REGRESSION: MOOD ---
{reg_block(reg_mood, 'mood')}

--- OLS REGRESSION: ENERGY ---
{reg_block(reg_energy, 'energy')}

--- TIME-SERIES TREND ---
{ts_block}

=====================================

Answer the user's question using the data above.
"""
    return prompt


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
def chat(body: ChatRequest):
    """
    Streaming chat endpoint. Accepts conversation history and returns
    a server-sent event stream of the assistant reply.
    """
    client = _get_client()
    system_prompt = _build_system_prompt()

    messages = [{"role": "system", "content": system_prompt}]
    for m in body.messages:
        if m.role in ("user", "assistant"):
            messages.append({"role": m.role, "content": m.content})

    def generate():
        try:
            stream = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                stream=True,
                temperature=0.4,
                max_tokens=120,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    payload = json.dumps({"token": delta.content})
                    yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            error_payload = json.dumps({"error": str(exc)})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

