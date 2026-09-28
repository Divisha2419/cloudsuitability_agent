"""The three-phase assessment described in prompts/system_prompt.md.

Phase 1 applies hard filters, Phase 2 rates the tech stack, Phase 3 computes
the Cloud Native Score and the 6R recommendation. All three phases are always
computed (behaviour rule 2): when a hard filter fires, Phases 2 and 3 are kept
for roadmap planning but the filter decides the primary recommendation.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from . import techstack
from .schema import Answers, missing_required, normalize, option_label, rubric_config, tech_config

MIGRATING = {"rehost", "replatform", "refactor", "replace"}


def _yes(answers: Answers, fid: str) -> bool:
    return answers.get(fid) == "Yes"


# --------------------------------------------------------------------------- Phase 1


def phase1(answers: Answers) -> dict:
    roadmap = answers.get("app_roadmap")
    status = answers.get("app_status")
    filters = []
    if roadmap == "To be decommissioned" or status in ("To be decommissioned", "Retired"):
        filters.append({
            "id": "decommission",
            "reason": f"Application is being decommissioned (Roadmap: {roadmap or '—'}; Status: {status or '—'}).",
            "outcome": "Stop — do not assess further",
            "recommendation": "retire",
        })
    if _yes(answers, "hardware_dependency") and _yes(answers, "proximity_to_equipment"):
        filters.append({
            "id": "hardware_proximity",
            "reason": "Application depends on physical hardware and must run close to that equipment.",
            "outcome": "Not suitable for full cloud migration",
            "recommendation": "retain",
        })
    if _yes(answers, "mainframe_dependency"):
        filters.append({
            "id": "mainframe",
            "reason": "Application depends on a mainframe.",
            "outcome": "Not suitable without major transformation — flag for Refactor/Replace review",
            "recommendation": "retain",
        })
    if answers.get("latency") == "Ultra Low":
        filters.append({
            "id": "ultra_low_latency",
            "reason": "Latency requirement is Ultra Low (<10 ms).",
            "outcome": "Latency disqualifier — Retain on-premise or Edge",
            "recommendation": "retain",
        })
    return {"triggered": bool(filters), "status": "TRIGGERED" if filters else "PASS", "filters": filters}


# --------------------------------------------------------------------------- Phase 2

COMPONENT_FIELDS = {
    "operating_system": "operating_system",
    "database": "database",
    "programming_language": "programming_language",
    "app_server": "app_server",
}


def phase2(answers: Answers) -> dict:
    labels = tech_config()["ratings"]
    components = []
    for comp_id, fid in COMPONENT_FIELDS.items():
        text = answers.get(fid)
        if comp_id == "programming_language" and answers.get("cots_or_custom") == "COTS":
            text = "COTS (no custom code)"
            rating = techstack.Rating("na", "COTS (no custom code)", "assessed via OS/DB")
        else:
            rating = techstack.rate(comp_id, text)
        components.append({
            "id": comp_id,
            "label": tech_config()["components"][comp_id]["label"],
            "input": text or "Not provided",
            **rating.to_dict(),
            "rating_label": labels[rating.rating],
        })
    rated = [c["rating"] for c in components if c["rating"] != "na"]
    if "not_suitable" in rated:
        overall = "not_suitable"
    elif "needs_upgrade" in rated:
        overall = "conditional"
    else:
        overall = "fully_ready"
    return {
        "components": components,
        "overall": overall,
        "overall_label": rubric_config()["phase2_overall"][overall],
    }


# --------------------------------------------------------------------------- Phase 3


def phase3(answers: Answers, p2: dict) -> dict:
    ratings = {c["id"]: c["rating"] for c in p2["components"]}
    dims = []
    for dim in rubric_config()["dimensions"]:
        if dim["source"] == "attribute":
            key = answers.get(dim["attribute"])
            shown = option_label(dim["attribute"], key)
        else:
            key = ratings[dim["component"]]
            shown = tech_config()["ratings"][key]
        score = dim["points"].get(key, 0) if key is not None else 0
        dims.append({
            "id": dim["id"],
            "label": dim["label"],
            "short": dim["short"],
            "weight": dim["weight"],
            "score": score,
            "answer": shown or "Not answered",
            "answered": key is not None,
        })
    total = sum(d["score"] for d in dims)
    band = next(b for b in rubric_config()["bands"] if total >= b["min"])
    return {"dimensions": dims, "total": total, "max": sum(d["weight"] for d in dims), "band": band}


# --------------------------------------------------------------------------- 6R


def recommend(answers: Answers, p1: dict, p2: dict, p3: dict) -> dict:
    """Apply the 6R rules in priority order; the first match wins."""
    score = p3["total"]
    band = p3["band"]["label"]
    overall = p2["overall"]
    filters = {f["id"]: f for f in p1["filters"]}
    needs_upgrade = [c["label"] for c in p2["components"] if c["rating"] == "needs_upgrade"]
    not_suitable = [c["label"] for c in p2["components"] if c["rating"] == "not_suitable"]
    cots = answers.get("cots_or_custom") in ("COTS", "Customised COTS")
    headline = None
    notes: list[str] = []

    if "decommission" in filters:
        code, rule = "retire", 1
        rationale = [
            filters["decommission"]["reason"],
            "Migrating an application that is being decommissioned would spend effort with no lasting benefit.",
        ]
    elif cots and answers.get("saas_equivalent") == "Yes":
        code, rule = "replace", 2
        product = answers.get("cots_details") or "the product"
        rationale = [
            f"The application is a COTS product ({product}) and the vendor offers a SaaS equivalent.",
            "Moving to the vendor's SaaS removes the need to host, patch and upgrade the application yourself.",
        ]
        if answers.get("cots_or_custom") == "Customised COTS":
            rationale.append("It is customised, so confirm the SaaS version can support those customisations.")
    elif p1["triggered"]:
        code, rule = "retain", 3
        rationale = [f["reason"] for f in p1["filters"]]
        if "ultra_low_latency" in filters:
            headline = "RETAIN ON-PREMISE / EDGE"
            rationale.append("Ultra-low latency workloads can alternatively run on edge infrastructure close to the users or devices.")
        if "mainframe" in filters:
            notes.append("Mainframe dependency: flag for a Refactor/Replace review.")
    elif score >= 70 and overall == "fully_ready":
        code, rule = "rehost", 4
        rationale = [
            f"Cloud Native Score is {score}/100 ({band}), at or above the Rehost threshold of 70.",
            "Every tech stack component is Cloud Ready, so it can move without upgrades.",
        ]
    elif 50 <= score <= 69 or overall == "conditional":
        code, rule = "replatform", 5
        rationale = [f"Cloud Native Score is {score}/100 ({band})."]
        if needs_upgrade:
            rationale.append(f"Components needing an upgrade before migration: {', '.join(needs_upgrade)}.")
        if not_suitable:
            rationale.append(f"Components not cloud suitable, to be replaced during replatforming: {', '.join(not_suitable)}.")
        rationale.append("Upgrading these and adopting managed services avoids changes to the core code.")
    elif 30 <= score <= 49 and (
        answers.get("architecture") == "Monolithic"
        or answers.get("coupling") == "Tightly coupled"
        or answers.get("app_state") == "Stateful"
    ):
        code, rule = "refactor", 6
        traits = [
            t
            for t, on in (
                ("monolithic", answers.get("architecture") == "Monolithic"),
                ("tightly coupled", answers.get("coupling") == "Tightly coupled"),
                ("stateful", answers.get("app_state") == "Stateful"),
            )
            if on
        ]
        rationale = [
            f"Cloud Native Score is {score}/100 ({band}).",
            f"The application is {', '.join(traits)}, which limits the benefit of moving it as-is.",
            "Re-architecting it (e.g. splitting services, externalising state, containerising) is needed first.",
        ]
    elif score < 30 or overall == "not_suitable":
        code, rule = "retain", 7
        rationale = [f"Cloud Native Score is {score}/100 ({band})."]
        if not_suitable:
            rationale.append(f"Components not cloud suitable: {', '.join(not_suitable)}.")
        rationale.append("Keep it on-premise until it is refactored or replaced.")
    else:
        # The rules in the instructions leave a small gap (e.g. score 30–49,
        # Fully Cloud Ready, not monolithic/tightly coupled/stateful).
        code, rule = "replatform", 0
        rationale = [
            f"Cloud Native Score is {score}/100 ({band}) and the tech stack is {p2['overall_label']}.",
            "No 6R rule matched exactly; Replatform is the closest fit. Review this recommendation manually.",
        ]

    if _yes(answers, "safety_critical_ot") and code in MIGRATING:
        notes.append(
            "Safety-critical OT application: requires a dedicated OT cloud security review before any migration."
        )

    six_r = rubric_config()["six_r"][code]
    return {
        "code": code,
        "label": six_r["label"],
        "headline": headline or six_r["headline"],
        "definition": six_r["definition"],
        "rule": rule,
        "rationale": rationale[:4],
        "next_steps": six_r["next_steps"],
        "notes": notes,
    }


# --------------------------------------------------------------------------- risks


def risks(answers: Answers, p2: dict) -> list[dict]:
    out: list[dict] = []

    def add(severity: str, message: str) -> None:
        out.append({"severity": severity, "message": message})

    for c in p2["components"]:
        if c["rating"] == "not_suitable":
            add("high", f"{c['label']} \"{c['input']}\" is not cloud suitable ({c['matched']}).")
        elif c["verification_required"]:
            add("medium", f"{c['label']}: {c['detail']}.")
        elif c["rating"] == "needs_upgrade":
            detail = f" — {c['detail']}" if c["detail"] else ""
            add("medium", f"{c['label']} \"{c['input']}\" needs an upgrade ({c['matched']}{detail}).")
    if _yes(answers, "safety_critical_ot"):
        add("high", "Safety-critical OT application (e.g. IEC 61508): requires a dedicated OT cloud security review.")
    if _yes(answers, "hardware_dependency"):
        details = answers.get("hardware_details")
        add("high", "Hardware dependency" + (f": {details}." if details else "."))
    if _yes(answers, "mainframe_dependency"):
        add("high", "Mainframe dependency.")
    latency = answers.get("latency")
    if latency == "Ultra Low":
        add("high", "Ultra-low latency requirement (<10 ms).")
    elif latency == "Low":
        add("medium", "Low latency requirement (10–100 ms): place the cloud region close to users/devices.")
    if _yes(answers, "real_time_decisioning"):
        add("medium", "Real-time decisioning: network outages to the cloud could interrupt automated decisions.")
    if _yes(answers, "ip_sensitive_data"):
        add("medium", "Processes IP-sensitive data: confirm data classification, encryption and access controls.")
    if answers.get("regulatory"):
        add("medium", f"Regulatory/contractual requirements: {answers['regulatory']} — confirm data residency in the target region.")
    if answers.get("business_criticality") == "Mission Critical" and (
        answers.get("high_availability") == "No HA" or answers.get("dr_requirements") == "No DR"
    ):
        add("medium", "Mission-critical application without HA/DR today: design HA and DR into the cloud target.")
    if answers.get("source_code") in ("No", "NA"):
        add("low", "Source code is not available, which limits refactoring options.")
    if answers.get("cots_or_custom") in ("COTS", "Customised COTS"):
        add("low", "COTS product: confirm the vendor supports cloud deployment and that licences are portable (vendor lock-in).")
    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(out, key=lambda r: order[r["severity"]])


# --------------------------------------------------------------------------- entry point


def assess(raw_answers: dict[str, Any], assessed_on: date | None = None) -> dict:
    """Run all three phases. Works on partial answers (for the live preview)."""
    answers, errors = normalize(raw_answers)
    p1 = phase1(answers)
    p2 = phase2(answers)
    p3 = phase3(answers, p2)
    missing = missing_required(answers)
    return {
        "application": {
            "name": answers.get("app_name", ""),
            "id": answers.get("app_id", ""),
            "manager": answers.get("app_manager", ""),
            "date": (assessed_on or date.today()).isoformat(),
        },
        "complete": not missing and not errors,
        "missing_required": missing,
        "errors": errors,
        "answers": answers,
        "phase1": p1,
        "phase2": p2,
        "phase3": p3,
        "recommendation": recommend(answers, p1, p2, p3),
        "risks": risks(answers, p2),
        "six_r_definitions": {k: v["definition"] for k, v in rubric_config()["six_r"].items()},
    }
