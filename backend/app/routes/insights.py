"""Insights routes — correlation analysis, regression, time-series."""

from fastapi import APIRouter, Query

from ..insights_engine import (
    compute_multiple_regression,
    compute_tag_correlations,
    compute_timeseries_regression,
    generate_insight_cards,
)
from ..storage import list_entries

router = APIRouter()


@router.get("/insights/cards")
def insight_cards():
    """
    Returns human-readable insight cards derived from statistical analysis.
    Cards are sorted by confidence (highest first).
    Only cards with sufficient data and confidence are included.
    """
    entries = list_entries()
    return generate_insight_cards(entries)


@router.get("/insights/correlations")
def tag_correlations():
    """
    Per-tag correlation data: average mood/energy with vs without each tag,
    Pearson correlation coefficient, and confidence score.
    Useful for rendering the Tag Impact chart.
    """
    entries = list_entries()
    return compute_tag_correlations(entries)


@router.get("/insights/regression")
def regression(target: str = Query("mood", pattern="^(mood|energy)$")):
    """
    OLS multiple regression: predict mood or energy from tag features + hour-of-day.
    Returns coefficients, R², intercept, and feature list.
    target: 'mood' (default) or 'energy'
    """
    entries = list_entries()
    result = compute_multiple_regression(entries, target=target)
    if result is None:
        return {"error": "Not enough data for regression analysis", "n": len(entries)}
    return result


@router.get("/insights/timeseries")
def timeseries():
    """
    Time-series regression: daily averages with OLS trend line +
    7-day rolling average for mood and energy.
    """
    entries = list_entries()
    return compute_timeseries_regression(entries)
