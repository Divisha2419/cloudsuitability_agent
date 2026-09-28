"""Phase 2 — rates free-text tech stack answers using config/tech_stack_ratings.yaml."""

from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from functools import lru_cache

from .schema import tech_config

SEVERITY = {"na": 0, "cloud_ready": 1, "needs_upgrade": 2, "not_suitable": 3}
_SPLIT = re.compile(r"\s*(?:,|;|\+|&|\band\b)\s*")


@dataclass
class Rating:
    rating: str
    matched: str  # the lookup-table row that matched, or why none did
    detail: str = ""
    verification_required: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@lru_cache
def _rules(component: str) -> list[tuple[re.Pattern, dict]]:
    rules = tech_config()["components"][component]["rules"]
    return [(re.compile(r["pattern"], re.IGNORECASE), r) for r in rules]


def _normalize(text: str) -> str:
    return re.sub(r"\bmicrosoft\b", "ms", " ".join(text.lower().split()))


def _rate_part(component: str, part: str) -> Rating:
    for pattern, rule in _rules(component):
        if pattern.search(part):
            return Rating(rule["rating"], rule["label"], rule.get("detail", ""))
    return Rating(
        "needs_upgrade",
        "Not in lookup table",
        f'"{part}" is not in the lookup table — verification required',
        verification_required=True,
    )


def rate(component: str, text: str | None) -> Rating:
    """Rate one component. Multiple technologies are rated separately; the worst wins."""
    if not text or not text.strip():
        return Rating("needs_upgrade", "Not provided", "not provided — verification required", True)
    parts = [p for p in _SPLIT.split(_normalize(text)) if p]
    ratings = [_rate_part(component, p) for p in parts] or [_rate_part(component, _normalize(text))]
    worst = max(ratings, key=lambda r: SEVERITY[r.rating])
    if len(ratings) > 1:
        worst.verification_required = any(r.verification_required for r in ratings)
    return worst
