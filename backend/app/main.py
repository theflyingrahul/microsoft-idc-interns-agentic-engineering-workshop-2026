"""Pulse API — Mood & Energy Tracker backend."""

from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory (one level up from this package)
load_dotenv(Path(__file__).parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import chat, entries, insights, stats, tags

app = FastAPI(
    title="Pulse API",
    description="Mood & Energy Tracker — backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entries.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(insights.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
def root():
    return {"app": "Pulse", "status": "running"}
