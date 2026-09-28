"""Plain-text report in the "Output Report Format" from prompts/system_prompt.md."""

from __future__ import annotations

RULE = "─" * 50


def _section(title: str) -> list[str]:
    return [RULE, title, RULE]


def text_report(result: dict) -> str:
    app = result["application"]
    p1, p2, p3, rec = result["phase1"], result["phase2"], result["phase3"], result["recommendation"]
    lines = [
        "╔══════════════════════════════════════════════════╗",
        "║         CLOUD SUITABILITY ASSESSMENT REPORT      ║",
        "╚══════════════════════════════════════════════════╝",
        "",
        f"Application: {app['name'] or '—'} | ID: {app['id'] or '—'}",
        f"Assessed by: {app['manager'] or '—'} | Date: {app['date']}",
        "",
        *_section("PHASE 1 – HARD FILTER RESULT"),
        p1["status"],
    ]
    if p1["triggered"]:
        lines += [f"Reason: {f['reason']} → {f['outcome']}" for f in p1["filters"]]
        lines.append("(Phases 2 and 3 below are for roadmap planning only.)")
    lines.append("")

    lines += _section("PHASE 2 – TECH STACK CLOUD SUITABILITY")
    names = {"operating_system": "Operating System", "database": "Database",
             "programming_language": "Programming Language", "app_server": "App/Web Server"}
    for c in p2["components"]:
        lines.append(f"{names[c['id']]:<20}: {c['input']:<24} →  {c['rating_label']}")
    lines += ["", f"{'Overall Tech Stack':<20}: {p2['overall_label']}", ""]

    lines += _section("PHASE 3 – CLOUD NATIVE SCORE")
    for d in p3["dimensions"]:
        lines.append(f"{d['short']:<20}: {d['score']}/{d['weight']}")
    lines += ["", f"{'TOTAL SCORE':<20}: {p3['total']}/{p3['max']}  →  {p3['band']['label']}", ""]

    lines += _section("6R RECOMMENDATION")
    lines += [f"Recommendation:  ★ {rec['headline']}", f"  {rec['definition']}", "", "Rationale:"]
    lines += [f"  • {r}" for r in rec["rationale"]]
    lines += [f"  ! {n}" for n in rec["notes"]]
    lines += ["", "Next Steps:"]
    lines += [f"  {i}. {s}" for i, s in enumerate(rec["next_steps"], 1)]
    lines.append("")

    lines += _section("KEY RISKS & FLAGS")
    lines += [f"  [{r['severity'].upper()}] {r['message']}" for r in result["risks"]] or ["  None identified."]
    return "\n".join(lines) + "\n"
