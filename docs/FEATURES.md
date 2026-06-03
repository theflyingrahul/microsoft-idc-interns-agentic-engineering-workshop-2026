# Pulse — Correlation Insights Engine: Feature Documentation

## Overview

This document describes all new features added to the Pulse mood & energy tracker as part of the Correlation Insights Engine hackathon challenge. The goal was to turn Pulse from a passive diary into an intelligent, data-driven tool that surfaces meaningful patterns and lets users converse with their own data.

---

## 1. Correlation Insights Engine (Backend)

**File:** `backend/app/insights_engine.py`

All statistical logic is centralised in a single module so it can be reused by both the insights API routes and the chatbot.

### 1.1 Tag Correlations

For every tag that appears at least 5 times in the user's history, the engine computes:

- **Average mood/energy WITH the tag** vs **WITHOUT the tag**
- **Delta (Δ):** the difference between the two averages
- **Pearson correlation coefficient (r):** point-biserial correlation between the binary tag presence and the continuous outcome (mood or energy)
- **Confidence score (0–100):** derived from Fisher's z-transform standard error — `SE = 1/√(n-3)`. Larger sample size → smaller SE → higher confidence. Capped at 95 to avoid implying certainty.

Minimum requirements: 7 total entries, 5 entries with the tag, 5 entries without.

### 1.2 OLS Multiple Regression

Predicts mood or energy from a feature matrix using Ordinary Least Squares:

```
β = (XᵀX)⁻¹ Xᵀy
```

Computed with `numpy.linalg.lstsq` for numerical stability.

**Features:**
- One binary column per tag that appears ≥ 5 times (1 = tag present in entry, 0 = absent)
- `hour_of_day`: the entry's hour normalised to [0, 1] (captures time-of-day effects)

**Outputs:**
- `coefficients`: sorted list of `{feature, coef, abs_coef}` — magnitude indicates relative importance
- `intercept`: baseline predicted value when all features are 0
- `r_squared`: proportion of variance in mood/energy explained by the features
- `n`: sample size

### 1.3 Time-Series Regression

Aggregates entries to daily averages and computes:

- **OLS linear trend line** over daily averages: `y = intercept + slope × day_index`
  - `mood_slope` and `energy_slope` in pts/day indicate whether the user is improving or declining
- **7-day rolling average** for both mood and energy (smooths out noise)
- Both the raw daily actuals and the computed values are returned together in a single `series` array for easy frontend charting

### 1.4 Compound Tag Analysis

Finds tag **pairs** that co-occur at least 5 times and computes their combined average mood and energy vs. the global averages. Returns the top 5 pairs by mood lift, helping surface combinations like "caffeine + deep-work = peak energy".

### 1.5 Insight Card Generator

Auto-generates human-readable insight cards from the statistical outputs:

- **Tag cards:** one for mood, one for energy per tag, if confidence ≥ 40%
- **Compound cards:** top co-occurring pairs with positive mood lift
- **Trend card:** if the mood slope is significant (|slope| > 0.005) and consistent over 7+ days
- **Time-of-day card:** compares morning vs. evening energy using entries before noon vs. after 5 PM

Each card has:
- `id`: stable string (used for dismiss/snooze persistence)
- `icon`: emoji
- `title`: short headline (non-causal phrasing)
- `description`: full sentence with exact numbers
- `confidence`: 0–100 score
- `category`: `tag | compound | trend | time`
- `metric`: `mood | energy`
- `delta`: signed numeric change

---

## 2. Insights API Routes

**File:** `backend/app/routes/insights.py`

Four new endpoints registered under `/api/insights/`:

| Endpoint | Description |
|---|---|
| `GET /api/insights/cards` | Auto-generated insight cards, sorted by confidence. Only cards ≥ 40% confidence are included. |
| `GET /api/insights/correlations` | Per-tag correlation data: avg with/without, Δ, Pearson r, confidence, count. |
| `GET /api/insights/regression?target=mood\|energy` | OLS regression result: all coefficients, R², intercept, n. |
| `GET /api/insights/timeseries` | Daily actuals + OLS trend line + 7-day rolling avg for both mood and energy. |

---

## 3. Enhanced Dashboard Stats

**File:** `backend/app/routes/stats.py` — new endpoint `GET /api/stats/summary`

Returns a rich summary of the user's data for the dashboard:

| Field | Description |
|---|---|
| `today_mood / today_energy` | Average of today's entries (null if none logged) |
| `today_count` | Number of entries logged today |
| `baseline_7d_mood / baseline_7d_energy` | Rolling 7-day average excluding today |
| `baseline_30d_mood / baseline_30d_energy` | Rolling 30-day average excluding today |
| `mood_vs_7d / energy_vs_7d` | Delta of today's score vs 7-day baseline |
| `streak` | Consecutive days (ending today or yesterday) with at least 1 entry |
| `all_time_mood / all_time_energy` | Overall averages across all data |
| `total_entries` | Total entries ever logged |

---

## 4. Insights Page (Frontend)

**File:** `frontend/src/pages/Insights.tsx`

A new `/insights` route added to the app with four sections:

### 4.1 Insight Cards

- Displays auto-generated cards from `/api/insights/cards`
- Positive associations (Δ > 0) are grouped separately from negative ones
- Empty state shown if fewer than 7 entries exist
- Each card is **dismissible** (removed permanently) or **snoozeable** (hidden for 7 days or 1 month)
- Dismiss/snooze state is stored in `localStorage` and applied client-side on load

### 4.2 Tag Impact Chart (`TagImpactChart.tsx`)

- Grouped bar chart using Recharts
- Shows "With tag" vs "Without tag" average for each eligible tag
- Toggle between mood and energy metric
- Green bars = positive association, red = negative
- Custom tooltip shows full correlation details on hover

### 4.3 OLS Regression Coefficient Chart (`RegressionCoeffChart.tsx`)

- Horizontal bar chart of all OLS coefficients
- Toggle between mood and energy target
- R² badge with plain-language explanation ("explains X% of variance")
- Green bars = positively associated with outcome, red = negatively
- Custom tooltip explains the coefficient direction

### 4.4 Trend Over Time Chart (`TrendlineChart.tsx`)

- Three overlaid lines:
  - **Grey thin line:** raw daily averages (noisy, shows actual data)
  - **Indigo thick line:** 7-day rolling average (smoothed trend)
  - **Dashed orange/red line:** OLS linear trend (overall direction)
- Toggle between mood and energy
- Slope direction shown as a natural-language sentence above the chart (e.g. "Your mood is improving by ~0.03 pts per week")
- Toggle between mood and energy metric

### 4.5 Transparency Note

A blue info box at the bottom of the Insights page explains:
- Correlations ≠ causation
- Minimum data thresholds
- What confidence scores mean
- That regression is recomputed on every visit
- That dismiss/snooze is stored locally

---

## 5. Dashboard Upgrades (Frontend)

**File:** `frontend/src/pages/Dashboard.tsx`

The dashboard now fetches `/api/stats/summary` in addition to the existing calls.

**New UI elements:**

- **Today section** — the 3 existing stat cards now show a delta indicator (`▲ / ▼ X.X pts vs 7-day avg`) when today has entries and a baseline exists
- **Your Baseline section** — 4 colour-coded cards showing:
  - 7-day avg mood (indigo)
  - 7-day avg energy (emerald)
  - 30-day avg mood (violet)
  - All-time avg energy + total entry count (sky)
- **🔥 Streak badge** — appears top-right when the user has a consecutive logging streak of 1+ days

---

## 6. Pulse Assistant (Chatbot)

**Files:** `backend/app/routes/chat.py`, `frontend/src/components/ChatBubble.tsx`

### 6.1 Backend

- `POST /api/chat` — accepts a list of `{role, content}` messages and returns a **Server-Sent Events (SSE) stream** of tokens
- Uses **GitHub Models** (`gpt-4o-mini`) via the OpenAI-compatible endpoint at `https://models.inference.ai.azure.com`
- Requires a `GITHUB_TOKEN` environment variable (loaded from `backend/.env` via `python-dotenv`)

**System prompt construction:**
On every request, the full statistical report is freshly computed and injected as the system prompt. This includes:
- Today's and historical summary stats
- All insight cards with exact numbers and descriptions
- All tag correlations (avg with/without, Δ, r, confidence) for every tag
- All compound tag pair results
- Full OLS regression output (all coefficients, R², intercept) for both mood and energy
- Last 14 days of daily averages with trend and rolling values
- Logging streak

**Response style rules enforced in the prompt:**
- Plain conversational text only — no markdown, no bullet points, no asterisks
- Under 60 words per response
- Short sentences, like texting
- Always uses "correlates with", never "causes"
- Quotes exact numbers

### 6.2 Frontend

`ChatBubble.tsx` renders as a floating 💬 button in the bottom-right corner on every page (mounted in `Layout.tsx`).

**Features:**
- Opens a compact chat panel (360×520 px max)
- **4 suggested starter questions** shown when conversation is empty
- **Streaming output** — tokens appear as they arrive, with a typing indicator (animated dots) while waiting
- **Clear conversation** button
- Enter to send, Shift+Enter for new line
- **`stripMarkdown()`** — runs once when the stream finishes to clean any stray formatting characters from the response. Applied post-stream (not per-token) to avoid stripping spaces mid-word.
- Error messages shown inline if the API key is missing or the request fails

### 6.3 Environment Setup

```
# backend/.env  (gitignored — never committed)
GITHUB_TOKEN=ghp_your_token_here
```

`backend/.env.example` is committed as a safe template.

---

## 7. File Map

### New Backend Files
| File | Purpose |
|---|---|
| `backend/app/insights_engine.py` | All statistical logic (correlations, regression, time-series, cards) |
| `backend/app/routes/insights.py` | `/api/insights/*` endpoints |
| `backend/app/routes/chat.py` | `/api/chat` streaming SSE endpoint |
| `backend/.env` | Local secrets (gitignored) |
| `backend/.env.example` | Committed template |

### Modified Backend Files
| File | Change |
|---|---|
| `backend/app/main.py` | Registers insights, chat routers; loads `.env` via `python-dotenv` |
| `backend/app/routes/stats.py` | Added `GET /api/stats/summary` |
| `backend/requirements.txt` | Added `numpy`, `openai`, `python-dotenv` |

### New Frontend Files
| File | Purpose |
|---|---|
| `frontend/src/components/InsightCard.tsx` | Dismissible/snoozeable insight card |
| `frontend/src/components/TagImpactChart.tsx` | Tag correlation grouped bar chart |
| `frontend/src/components/RegressionCoeffChart.tsx` | OLS coefficient horizontal bar chart |
| `frontend/src/components/TrendlineChart.tsx` | Time-series with trend line and rolling avg |
| `frontend/src/components/ChatBubble.tsx` | Floating chat assistant widget |
| `frontend/src/pages/Insights.tsx` | Full insights page |

### Modified Frontend Files
| File | Change |
|---|---|
| `frontend/src/App.tsx` | Added `/insights` route |
| `frontend/src/components/Layout.tsx` | Added Insights nav link; mounts `ChatBubble` |
| `frontend/src/pages/Dashboard.tsx` | Fetches summary stats; new baseline and delta UI |
| `frontend/src/lib/types.ts` | Added `InsightCard`, `TagCorrelation`, `RegressionResult`, `TimeseriesResult`, `SummaryStats` |
| `frontend/src/lib/api.ts` | Added `api.insights.*` and `api.stats.summary()` |
