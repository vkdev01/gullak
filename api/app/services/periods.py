"""Salary-anchored periods.

A household whose salary lands on the 25th does not have a month that runs
1st to 30th, and every number in the product — budgets, pace, the dashboard,
the summary — has to agree on where the period starts. So it lives here, once.
"""

from __future__ import annotations

from datetime import date, timedelta


def _add_months(day: date, months: int) -> date:
    month = day.month - 1 + months
    year = day.year + month // 12
    month = month % 12 + 1
    # clamp to the last day of the target month
    for candidate in (day.day, 30, 29, 28):
        try:
            return date(year, month, min(candidate, day.day))
        except ValueError:
            continue
    return date(year, month, 28)


def period_bounds(anchor_day: int, on: date) -> tuple[date, date]:
    """The period containing `on`, for a cycle anchored on `anchor_day`."""
    anchor_day = max(1, min(anchor_day, 28))
    start_this_month = date(on.year, on.month, anchor_day)
    if on >= start_this_month:
        start = start_this_month
        end = _add_months(start, 1) - timedelta(days=1)
    else:
        start = _add_months(start_this_month, -1)
        end = start_this_month - timedelta(days=1)
    return start, end


def previous_period(anchor_day: int, start: date) -> tuple[date, date]:
    prev_start = _add_months(start, -1)
    return prev_start, start - timedelta(days=1)


def elapsed_fraction(start: date, end: date, today: date) -> float:
    total = (end - start).days + 1
    if total <= 0:
        return 1.0
    done = (min(today, end) - start).days + 1
    return max(0.0, min(1.0, done / total))


def period_label(start: date, end: date) -> str:
    if start.month == end.month:
        return start.strftime("%B %Y")
    return f"{start.strftime('%d %b')} – {end.strftime('%d %b %Y')}"
