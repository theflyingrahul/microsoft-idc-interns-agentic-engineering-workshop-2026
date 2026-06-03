# Pulse — Mood & Energy Tracker

A personal well-being tracker where you log your mood and energy levels throughout the day, tag what influenced them, and see patterns over time. Built as the seed project for the **From Vibe Coding to Agentic Engineering** workshop.

---

## ✨ New Features — Correlation Insights Engine

The following features were added as part of the [Correlation Insights Engine](docs/FEATURES.md) challenge. Full technical documentation is in [`docs/FEATURES.md`](docs/FEATURES.md).

### 🔬 Statistical Analysis (Backend)
- **Tag correlations** — for every tag, computes average mood/energy with vs. without it, Pearson r, and a confidence score (Fisher z-transform based)
- **OLS multiple regression** (β = (XᵀX)⁻¹Xᵀy) — predicts mood or energy from tag features + hour-of-day; returns all coefficients and R²
- **Time-series regression** — daily averages with OLS linear trend line and 7-day rolling average
- **Compound tag analysis** — finds tag pairs that co-occur and computes their combined mood/energy lift vs. the global average
- **Insight card generator** — auto-writes human-readable, non-causal insight text with confidence indicators; enforces a minimum of 7 entries before surfacing any card

### 📊 Insights Page (`/insights`)
- **Insight cards** — dismissible and snoozeable (1 week / 1 month), with confidence bars and delta badges; state stored in `localStorage`
- **Tag Impact Chart** — interactive grouped bar chart comparing avg mood/energy with vs. without each tag; toggle between mood and energy
- **OLS Coefficient Chart** — horizontal bar chart of all regression coefficients with R² badge and plain-language explanation
- **Trend Over Time Chart** — overlays raw daily data, 7-day rolling average, and OLS linear trend line; toggle between mood and energy

### 📈 Enhanced Dashboard
- **Today's delta indicators** — shows ▲/▼ vs. your 7-day baseline on mood and energy cards
- **Baseline panel** — 4 colour-coded cards for 7-day, 30-day, and all-time averages
- **Logging streak badge** — 🔥 streak counter for consecutive days with entries

### 💬 Pulse Assistant (AI Chatbot)
- Floating chat bubble (bottom-right, available on every page)
- Powered by **GitHub Models** (`gpt-4o-mini`) via the OpenAI-compatible API
- Full statistical report injected as system context on every request — all correlation numbers, regression coefficients, trend data, and baselines
- Streams responses token-by-token (Server-Sent Events)
- Plain-text, conversational responses — no markdown formatting
- Requires `GITHUB_TOKEN` in `backend/.env`

### New API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/insights/cards` | Auto-generated insight cards (confidence ≥ 40%) |
| GET | `/api/insights/correlations` | Per-tag correlation data with full numbers |
| GET | `/api/insights/regression?target=mood\|energy` | OLS regression coefficients and R² |
| GET | `/api/insights/timeseries` | Daily actuals + trend line + 7-day rolling avg |
| GET | `/api/stats/summary` | Today's scores, baselines, deltas, and streak |
| POST | `/api/chat` | Streaming AI chat with full data context |

---

## What's Already Built

- Quick mood + energy logging (emoji scale + 1–10 slider + optional note)
- Tagging system (predefined tags: sleep, exercise, caffeine, meetings, commute, social + custom)
- Daily and weekly timeline view (line charts for mood & energy over time)
- Calendar heatmap (color-coded days by average mood)
- Entry history (scrollable, filterable list of past logs)

## Tech Stack

| Layer     | Tech                          |
|-----------|-------------------------------|
| Frontend  | React + Vite + TypeScript     |
| Styling   | Tailwind CSS                  |
| Charts    | Recharts                      |
| Backend   | Python + FastAPI              |
| Storage   | File-based JSON (`.data/`)    |

## Getting Started

### Prerequisites

- Node.js v20+
- Python 3.10+
- npm

### 1. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

The API will be running at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be running at `http://localhost:5173`.

### 3. Seed Data (Optional)

To populate the app with sample data so charts look meaningful:

```bash
cd backend
python seed.py
```

---

## Testing

### Backend Tests

```bash
cd backend
.venv\Scripts\pytest          # run tests
.venv\Scripts\mypy app         # type checking
```

### Frontend Tests

```bash
cd frontend
npm test -- --run              # run Vitest tests (non-watch mode)
npx tsc --noEmit               # type checking
```

---

## Project Structure

```
├── frontend/               # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/          # Dashboard, LogEntry, History
│   │   ├── components/     # Reusable UI components
│   │   └── lib/            # API client, types
│   └── tests/              # Vitest + React Testing Library tests
├── backend/                # Python FastAPI
│   ├── app/
│   │   ├── routes/         # API endpoints
│   │   └── models/         # Pydantic models
│   ├── tests/              # pytest tests
│   ├── storage.py          # File-based JSON storage
│   └── seed.py             # Sample data generator
├── briefs/                 # Feature request briefs for the workshop
│   ├── 01-correlation-insights.md
│   ├── 02-weekly-reflection.md
│   ├── 03-smart-nudges.md
│   ├── 04-team-pulse.md
│   └── 05-mood-aware-planner.md
└── README.md
```

---

## Workshop: Feature Briefs

The `briefs/` folder contains 5 feature requests written as messages from a fictional product lead. During the workshop:

1. **The presenter** will demo building one feature (Brief #1: Correlation Insights) using the agentic engineering flow
2. **Attendees** pick any of the remaining briefs (or invent their own) and follow the same flow

Each brief is designed to produce a rich grilling/design session with non-obvious decisions.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/entries` | Create a new mood/energy entry |
| GET | `/api/entries` | List entries (optional filters) |
| GET | `/api/entries/{id}` | Get a single entry |
| DELETE | `/api/entries/{id}` | Delete an entry |
| GET | `/api/stats/daily` | Daily averages (last 14 days) |
| GET | `/api/stats/weekly` | Weekly averages (last 8 weeks) |
| GET | `/api/stats/heatmap` | Calendar heatmap data |
| GET | `/api/stats/summary` | Today's scores, baselines, deltas, streak |
| GET | `/api/tags` | List all available tags |
| GET | `/api/insights/cards` | Auto-generated insight cards |
| GET | `/api/insights/correlations` | Per-tag correlation data |
| GET | `/api/insights/regression` | OLS regression coefficients and R² |
| GET | `/api/insights/timeseries` | Daily actuals + trend + rolling avg |
| POST | `/api/chat` | Streaming AI chat (SSE) |

---

## Inspiration

This repository and workshop have been heavily inspired by [Matt Pocock's AI Engineer Workshop](https://github.com/mattpocock/ai-engineer-workshop-2026-project/).
