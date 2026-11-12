"""Recurring detection.

A series is only claimed when the evidence is there: at least three
occurrences, a stable interval and a stable amount. Anything weaker is left
alone — inventing a subscription out of three unrelated Swiggy orders is worse
than missing one.
"""

from __future__ import annotations

import statistics
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Transaction

CADENCES = {
    "weekly": (6, 8, 7),
    "fortnightly": (13, 16, 14),
    "monthly": (27, 32, 30),
    "quarterly": (85, 95, 91),
    "yearly": (360, 370, 365),
}

# Merchants that are, by nature, subscriptions even before the interval is checked.
SUBSCRIPTION_HINTS = ("NETFLIX", "HOTSTAR", "SPOTIFY", "PRIME", "YOUTUBE", "ICLOUD", "GOOGLE ONE", "AUDIBLE", "CULT")


def _cadence(median_gap: float) -> str | None:
    for name, (low, high, _) in CADENCES.items():
        if low <= median_gap <= high:
            return name
    return None


def detect_series(db: Session, household_id: str, today: date | None = None) -> list[dict]:
    today = today or date.today()
    rows = list(
        db.scalars(
            select(Transaction)
            .where(
                Transaction.household_id == household_id,
                Transaction.direction == "debit",
                Transaction.transfer_id.is_(None),
            )
            .order_by(Transaction.occurred_at)
        )
    )

    by_merchant: dict[str, list[Transaction]] = {}
    for row in rows:
        by_merchant.setdefault(row.merchant, []).append(row)

    series: list[dict] = []
    for merchant, items in by_merchant.items():
        if len(items) < 3:
            continue

        dates = [i.occurred_at for i in items]
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]
        gaps = [g for g in gaps if g > 0]
        if len(gaps) < 2:
            continue

        median_gap = statistics.median(gaps)
        cadence = _cadence(median_gap)
        if not cadence:
            continue

        # intervals must be reasonably regular
        spread = statistics.pstdev(gaps)
        if spread > median_gap * 0.35:
            continue

        amounts = [i.amount for i in items]
        mean_amount = statistics.fmean(amounts)
        if mean_amount <= 0:
            continue
        if statistics.pstdev(amounts) / mean_amount > 0.25:
            continue

        step = CADENCES[cadence][2]
        last = dates[-1]
        next_due = last + timedelta(days=step)
        while next_due < today:
            next_due += timedelta(days=step)

        earlier = statistics.median(amounts[:-1]) if len(amounts) > 1 else amounts[-1]
        price_change = amounts[-1] - earlier
        is_subscription = (
            any(hint in merchant.upper() for hint in SUBSCRIPTION_HINTS)
            or (cadence == "monthly" and len(amounts) >= 3)
        )

        series.append(
            {
                "merchant": merchant,
                "cadence": cadence,
                "occurrences": len(items),
                "expected_amount": int(round(mean_amount)),
                "last_seen": last,
                "next_due": next_due,
                "is_subscription": is_subscription,
                "price_change": price_change if abs(price_change) > max(mean_amount * 0.05, 1000) else 0,
            }
        )

    series.sort(key=lambda s: s["next_due"])
    return series
