"""Turn a bank narration into (merchant, category, confidence, reason).

Order of authority: user rules, then the merchant seed list, then nothing. A
row that matches nothing is kept with confidence 0 and lands in the review
queue — silently guessing is worse than admitting ignorance.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Category, Rule
from . import merchants

RULE_CONFIDENCE = 1.0
MERCHANT_CONFIDENCE = 0.95
REVIEW_THRESHOLD = 0.7


@dataclass(frozen=True)
class Categorisation:
    merchant: str
    category_id: str | None
    confidence: float
    reason: str  # rule | merchant | none

    @property
    def needs_review(self) -> bool:
        return self.confidence < REVIEW_THRESHOLD


def load_rules(db: Session, household_id: str) -> list[Rule]:
    return list(
        db.scalars(
            select(Rule)
            .where(Rule.household_id == household_id)
            .order_by(Rule.priority.asc(), Rule.created_at.asc())
        )
    )


def category_lookup(db: Session, household_id: str) -> dict[str, str]:
    """Leaf category name → id. Parents are not a valid target for a transaction."""
    rows = db.scalars(
        select(Category).where(Category.household_id == household_id, Category.parent_id.is_not(None))
    )
    return {c.name: c.id for c in rows}


def _rule_matches(rule: Rule, description: str) -> bool:
    if rule.match_type == "equals":
        return description.strip().lower() == rule.pattern.strip().lower()
    if rule.match_type == "regex":
        try:
            return re.search(rule.pattern, description, re.IGNORECASE) is not None
        except re.error:
            return False
    return rule.pattern.lower() in description.lower()


def categorise(
    description: str,
    rules: list[Rule],
    categories: dict[str, str],
) -> Categorisation:
    canonical, category_name = merchants.match(description)
    merchant = canonical or merchants.normalise(description) or description[:80]

    for rule in rules:
        if _rule_matches(rule, description):
            return Categorisation(merchant, rule.category_id, RULE_CONFIDENCE, "rule")

    if category_name and category_name in categories:
        return Categorisation(merchant, categories[category_name], MERCHANT_CONFIDENCE, "merchant")

    return Categorisation(merchant, None, 0.0, "none")
