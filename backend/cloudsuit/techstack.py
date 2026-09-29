"""Phase 2 — rates free-text tech stack answers using config/tech_stack_ratings.yaml."""

from __future__ import annotations

import difflib
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


@lru_cache
def _aliases(component: str) -> list[tuple[str, dict]]:
    """(alias, product) pairs, longest alias first so "apache tomcat" wins over "apache"."""
    pairs = [(a.lower(), p) for p in tech_config().get("products", {}).get(component, []) for a in p["aliases"]]
    return sorted(pairs, key=lambda ap: -len(ap[0]))


def _find_product(part: str, component: str) -> dict | None:
    for alias, product in _aliases(component):
        if re.search(r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])", part):
            return product
    return None


def _matches_rule(component: str, part: str) -> bool:
    return any(pattern.search(part) for pattern, _ in _rules(component))


_TOKEN = re.compile(r"[a-z.#+][a-z0-9.#+-]*")


def _spelling_suggestion(component: str, part: str, original: str) -> tuple[str, str] | None:
    """Closest product name for a misspelt word (or 2–3 word phrase) in part.

    Returns (product name, original text with the misspelling replaced), or None.
    Only aliases of 4+ characters are compared, and the first letter must match,
    so unrelated words ("banana" vs "hana") are not "corrected".
    """
    tokens = _TOKEN.findall(part)
    best: tuple[float, str, dict] | None = None
    for n in (3, 2, 1):
        for i in range(len(tokens) - n + 1):
            phrase = " ".join(tokens[i : i + n])
            for alias, product in _aliases(component):
                if len(alias) < 4 or alias[0] != phrase[0]:
                    continue
                score = difflib.SequenceMatcher(None, phrase, alias).ratio()
                if score >= 0.8 and (best is None or score > best[0]):
                    best = (score, phrase, product)
    if best is None:
        return None
    _, phrase, product = best
    span = r"\s+".join(re.escape(t) for t in phrase.split())
    fixed = re.sub(span, product["name"], original, count=1, flags=re.IGNORECASE)
    return product["name"], fixed


def check(component: str, text: str | None) -> dict:
    """Input check for one tech-stack answer, shown to the user.

    status: ok | missing_version | suggestion | unrecognized | empty
    """
    if not text or not text.strip():
        return {"status": "empty", "message": "", "suggestion": ""}
    original = " ".join(text.split())
    parts = [p for p in _SPLIT.split(_normalize(text)) if p]
    for part in parts:
        product = _find_product(part, component)
        if product:
            if product.get("needs_version") and not re.search(r"\d", part):
                return {
                    "status": "missing_version",
                    "message": f"Please mention the version of {product['name']} as well. "
                    "Cloud compatibility cannot be determined without it.",
                    "suggestion": "",
                }
            continue
        if _matches_rule(component, part):
            continue  # e.g. "None", "flat files", "Unknown"
        fix = _spelling_suggestion(component, part, original)
        if fix:
            name, fixed = fix
            extra = "" if re.search(r"\d", part) else " Please also add the version."
            return {"status": "suggestion", "message": f'Did you mean "{name}"?{extra}', "suggestion": fixed}
        return {
            "status": "unrecognized",
            "message": f'"{part}" is not a recognised product. It needs to be checked.',
            "suggestion": "",
        }
    return {"status": "ok", "message": "", "suggestion": ""}


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
