"""Provisional cloud migration wave roadmap (config/migration_waves.yaml).

Each application goes into the first wave whose rule matches its 6R
recommendation and business criticality; the rest are "out of scope".
"""

from __future__ import annotations

from functools import lru_cache

from .schema import _load


@lru_cache
def waves_config() -> dict:
    return _load("migration_waves.yaml")


def _matches(rule: dict, row: dict) -> bool:
    recs = rule.get("recommendation")
    crit = rule.get("criticality")
    return (not recs or row["recommendation"] in recs) and (not crit or row["criticality"] in crit)


def roadmap(rows: list[dict]) -> dict | None:
    """Waves for a project's Admin rows, or None when there are too few applications."""
    cfg = waves_config()
    if len(rows) < cfg.get("min_applications", 6):
        return None
    order = {c: i for i, c in enumerate(cfg.get("criticality_order", []))}

    def sort_key(r: dict):
        return (order.get(r["criticality"], len(order)), -(r["score"] or 0), r["app_id"])

    def app(r: dict) -> dict:
        keys = ("id", "app_id", "app_name", "recommendation", "recommendation_headline", "criticality", "score")
        return {k: r[k] for k in keys}

    waves = [{**{k: w.get(k, "") for k in ("name", "timeframe", "description")}, "applications": []} for w in cfg["waves"]]
    out = {**cfg["out_of_scope"], "applications": []}
    for r in rows:
        target = next((w for w, rule in zip(waves, cfg["waves"]) if _matches(rule["match"], r)), out)
        target["applications"].append(r)
    for bucket in [*waves, out]:
        bucket["applications"] = [app(r) for r in sorted(bucket["applications"], key=sort_key)]
    return {"waves": [w for w in waves if w["applications"]], "out_of_scope": out}
