"""Stats routes — daily averages, weekly averages, heatmap data, summary."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from ..storage import list_entries

router = APIRouter()


@router.get("/stats/daily")
def daily_stats():
    """Daily mood & energy averages for the last 14 days."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=13)
    entries = list_entries(start_date=str(start))

    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        day = str(e.timestamp.date())
        by_day[day].append(e)

    result = []
    for i in range(14):
        day = str(start + timedelta(days=i))
        day_entries = by_day.get(day, [])
        result.append(
            {
                "date": day,
                "avg_mood": (
                    round(sum(e.mood for e in day_entries) / len(day_entries), 1)
                    if day_entries
                    else None
                ),
                "avg_energy": (
                    round(sum(e.energy for e in day_entries) / len(day_entries), 1)
                    if day_entries
                    else None
                ),
                "count": len(day_entries),
            }
        )
    return result


@router.get("/stats/weekly")
def weekly_stats():
    """Weekly mood & energy averages for the last 8 weeks."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(weeks=8)
    entries = list_entries(start_date=str(start))

    by_week: dict[str, list] = defaultdict(list)
    for e in entries:
        week_start = e.timestamp.date() - timedelta(days=e.timestamp.weekday())
        by_week[str(week_start)].append(e)

    result = []
    for i in range(8):
        week_start = start + timedelta(weeks=i) - timedelta(
            days=(start + timedelta(weeks=i)).weekday()
        )
        key = str(week_start)
        week_entries = by_week.get(key, [])
        result.append(
            {
                "week_start": key,
                "avg_mood": (
                    round(sum(e.mood for e in week_entries) / len(week_entries), 1)
                    if week_entries
                    else None
                ),
                "avg_energy": (
                    round(sum(e.energy for e in week_entries) / len(week_entries), 1)
                    if week_entries
                    else None
                ),
                "count": len(week_entries),
            }
        )
    return result


@router.get("/stats/heatmap")
def heatmap_data():
    """Calendar heatmap data — average mood per day for the last 90 days."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=89)
    entries = list_entries(start_date=str(start))

    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        day = str(e.timestamp.date())
        by_day[day].append(e)

    result = []
    for i in range(90):
        day = str(start + timedelta(days=i))
        day_entries = by_day.get(day, [])
        avg_mood = (
            round(sum(e.mood for e in day_entries) / len(day_entries), 1)
            if day_entries
            else None
        )
        result.append({"date": day, "avg_mood": avg_mood, "count": len(day_entries)})
    return result


@router.get("/stats/summary")
def summary_stats():
    """
    Rich dashboard summary combining today's data with historical baselines.

    Returns:
      - today_mood / today_energy: avg of today's entries (null if none logged)
      - today_count: entries logged today
      - baseline_7d_mood / baseline_7d_energy: rolling 7-day average (excl. today)
      - baseline_30d_mood / baseline_30d_energy: rolling 30-day average (excl. today)
      - mood_vs_7d / energy_vs_7d: delta of today vs 7-day baseline
      - streak: consecutive days (ending today or yesterday) with at least 1 entry
      - all_time_mood / all_time_energy: overall averages across all data
      - total_entries: total entries ever logged
    """
    today = datetime.now(timezone.utc).date()
    all_entries = list_entries()

    by_day: dict[str, list] = defaultdict(list)
    for e in all_entries:
        by_day[str(e.timestamp.date())].append(e)

    today_str = str(today)
    today_entries = by_day.get(today_str, [])

    def day_avg_mood(entries):
        return round(sum(e.mood for e in entries) / len(entries), 1) if entries else None

    def day_avg_energy(entries):
        return round(sum(e.energy for e in entries) / len(entries), 1) if entries else None

    today_mood = day_avg_mood(today_entries)
    today_energy = day_avg_energy(today_entries)

    # 7-day baseline: last 7 days EXCLUDING today
    last_7_entries = [
        e for e in all_entries
        if today - timedelta(days=7) <= e.timestamp.date() < today
    ]
    baseline_7d_mood = day_avg_mood(last_7_entries) if last_7_entries else None
    baseline_7d_energy = day_avg_energy(last_7_entries) if last_7_entries else None

    # 30-day baseline: last 30 days EXCLUDING today
    last_30_entries = [
        e for e in all_entries
        if today - timedelta(days=30) <= e.timestamp.date() < today
    ]
    baseline_30d_mood = day_avg_mood(last_30_entries) if last_30_entries else None
    baseline_30d_energy = day_avg_energy(last_30_entries) if last_30_entries else None

    # Deltas vs 7-day baseline
    mood_vs_7d = (
        round(today_mood - baseline_7d_mood, 1)
        if today_mood is not None and baseline_7d_mood is not None
        else None
    )
    energy_vs_7d = (
        round(today_energy - baseline_7d_energy, 1)
        if today_energy is not None and baseline_7d_energy is not None
        else None
    )

    # Streak: consecutive days with ≥1 entry, working backwards from today
    streak = 0
    check = today
    # If today has entries, start counting from today; otherwise start from yesterday
    if not today_entries:
        check = today - timedelta(days=1)
    while str(check) in by_day and by_day[str(check)]:
        streak += 1
        check -= timedelta(days=1)

    # All-time averages
    all_time_mood = (
        round(sum(e.mood for e in all_entries) / len(all_entries), 1)
        if all_entries else None
    )
    all_time_energy = (
        round(sum(e.energy for e in all_entries) / len(all_entries), 1)
        if all_entries else None
    )

    return {
        "today_mood": today_mood,
        "today_energy": today_energy,
        "today_count": len(today_entries),
        "baseline_7d_mood": baseline_7d_mood,
        "baseline_7d_energy": baseline_7d_energy,
        "baseline_30d_mood": baseline_30d_mood,
        "baseline_30d_energy": baseline_30d_energy,
        "mood_vs_7d": mood_vs_7d,
        "energy_vs_7d": energy_vs_7d,
        "streak": streak,
        "all_time_mood": all_time_mood,
        "all_time_energy": all_time_energy,
        "total_entries": len(all_entries),
    }



@router.get("/stats/daily")
def daily_stats():
    """Daily mood & energy averages for the last 14 days."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=13)
    entries = list_entries(start_date=str(start))

    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        day = str(e.timestamp.date())
        by_day[day].append(e)

    result = []
    for i in range(14):
        day = str(start + timedelta(days=i))
        day_entries = by_day.get(day, [])
        result.append(
            {
                "date": day,
                "avg_mood": (
                    round(sum(e.mood for e in day_entries) / len(day_entries), 1)
                    if day_entries
                    else None
                ),
                "avg_energy": (
                    round(sum(e.energy for e in day_entries) / len(day_entries), 1)
                    if day_entries
                    else None
                ),
                "count": len(day_entries),
            }
        )
    return result


@router.get("/stats/weekly")
def weekly_stats():
    """Weekly mood & energy averages for the last 8 weeks."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(weeks=8)
    entries = list_entries(start_date=str(start))

    by_week: dict[str, list] = defaultdict(list)
    for e in entries:
        week_start = e.timestamp.date() - timedelta(days=e.timestamp.weekday())
        by_week[str(week_start)].append(e)

    result = []
    for i in range(8):
        week_start = start + timedelta(weeks=i) - timedelta(
            days=(start + timedelta(weeks=i)).weekday()
        )
        key = str(week_start)
        week_entries = by_week.get(key, [])
        result.append(
            {
                "week_start": key,
                "avg_mood": (
                    round(sum(e.mood for e in week_entries) / len(week_entries), 1)
                    if week_entries
                    else None
                ),
                "avg_energy": (
                    round(sum(e.energy for e in week_entries) / len(week_entries), 1)
                    if week_entries
                    else None
                ),
                "count": len(week_entries),
            }
        )
    return result


@router.get("/stats/heatmap")
def heatmap_data():
    """Calendar heatmap data — average mood per day for the last 90 days."""
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=89)
    entries = list_entries(start_date=str(start))

    by_day: dict[str, list] = defaultdict(list)
    for e in entries:
        day = str(e.timestamp.date())
        by_day[day].append(e)

    result = []
    for i in range(90):
        day = str(start + timedelta(days=i))
        day_entries = by_day.get(day, [])
        avg_mood = (
            round(sum(e.mood for e in day_entries) / len(day_entries), 1)
            if day_entries
            else None
        )
        result.append({"date": day, "avg_mood": avg_mood, "count": len(day_entries)})
    return result
