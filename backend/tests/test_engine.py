from cloudsuit.engine import assess
from cloudsuit.report import text_report
from cloudsuit.schema import normalize, validate


def test_complete_cloud_native_app_is_rehost(answers):
    r = assess(answers)
    assert r["complete"]
    assert r["phase1"]["status"] == "PASS"
    assert r["phase2"]["overall"] == "fully_ready"
    # 15 + 7 + 8 + 12 + 8 + 10 + 10 + 8 + 7 + 5 + 5
    assert r["phase3"]["total"] == 95
    assert r["phase3"]["band"]["label"] == "High Cloud Readiness"
    assert r["recommendation"]["code"] == "rehost"
    assert r["recommendation"]["rule"] == 4


def test_select_accepts_labels_case_insensitively():
    answers, errors = normalize({"architecture": "microservices architecture", "latency": "Ultra Low Latency (<10 ms)"})
    assert errors == {}
    assert answers == {"architecture": "Microservices", "latency": "Ultra Low"}


def test_invalid_select_and_missing_required_are_reported(answers):
    answers["architecture"] = "Serverless"
    del answers["app_name"]
    _, errors = validate(answers)
    assert "architecture" in errors
    assert errors["app_name"] == "This field is required"


def test_hidden_fields_are_dropped_and_not_required(answers):
    answers["hardware_details"] = "PLC"
    answers["cots_details"] = "Some product"
    clean, errors = validate(answers)
    assert "hardware_details" not in clean  # hardware_dependency = No
    assert "cots_details" not in clean  # Inhouse built
    assert errors == {}


def test_proximity_required_when_hardware_dependency(answers):
    answers["hardware_dependency"] = "Yes"
    _, errors = validate(answers)
    assert "proximity_to_equipment" in errors


def test_decommission_is_retire_even_for_cots_with_saas(answers):
    answers.update(app_roadmap="To be decommissioned", cots_or_custom="COTS", saas_equivalent="Yes")
    r = assess(answers)
    assert r["phase1"]["triggered"]
    assert r["recommendation"]["code"] == "retire"
    assert r["recommendation"]["rule"] == 1


def test_cots_with_saas_equivalent_is_replace(answers):
    answers.update(cots_or_custom="COTS", saas_equivalent="Yes", cots_details="SAP ECC 6.0")
    r = assess(answers)
    assert r["recommendation"]["code"] == "replace"
    # COTS language is N/A and scores full points.
    lang = next(c for c in r["phase2"]["components"] if c["id"] == "programming_language")
    assert lang["rating"] == "na"


def test_hardware_with_proximity_is_retain(answers):
    answers.update(hardware_dependency="Yes", proximity_to_equipment="Yes")
    r = assess(answers)
    assert [f["id"] for f in r["phase1"]["filters"]] == ["hardware_proximity"]
    assert r["recommendation"]["code"] == "retain"
    assert r["recommendation"]["rule"] == 3
    # Phases 2 and 3 are still computed for roadmap planning.
    assert r["phase3"]["total"] > 0


def test_hardware_without_proximity_is_not_a_hard_filter(answers):
    answers.update(hardware_dependency="Yes", proximity_to_equipment="No")
    assert not assess(answers)["phase1"]["triggered"]


def test_ultra_low_latency_is_retain_or_edge(answers):
    answers["latency"] = "Ultra Low"
    rec = assess(answers)["recommendation"]
    assert rec["code"] == "retain"
    assert rec["headline"] == "RETAIN ON-PREMISE / EDGE"


def test_mainframe_is_retain_with_review_note(answers):
    answers["mainframe_dependency"] = "Yes"
    rec = assess(answers)["recommendation"]
    assert rec["code"] == "retain"
    assert any("Refactor/Replace" in n for n in rec["notes"])


def test_needs_upgrade_component_is_replatform(answers):
    answers["operating_system"] = "Windows Server 2012 R2"
    r = assess(answers)
    assert r["phase2"]["overall"] == "conditional"
    assert r["recommendation"]["code"] == "replatform"


def test_low_score_monolith_is_refactor(answers):
    answers.update(architecture="Monolithic", coupling="Tightly coupled", app_state="Stateful",
                   hardware_dependency="Yes", proximity_to_equipment="No", latency="Low",
                   source_code="No", operating_system="Windows Server 2008")
    r = assess(answers)
    # 3 + 2 + 3 + 0 + 4 + 0 + 10 + 8 + 7 + 0 + 5
    assert r["phase3"]["total"] == 42
    assert r["phase2"]["overall"] == "not_suitable"
    assert r["recommendation"]["code"] == "refactor"


def test_very_low_score_is_retain(answers):
    answers.update(architecture="Monolithic", coupling="Tightly coupled", app_state="Stateful",
                   hardware_dependency="Yes", proximity_to_equipment="No", latency="Low",
                   source_code="No", operating_system="Windows Server 2008", database="MS Access",
                   programming_language="VB6", app_server="IIS 6")
    r = assess(answers)
    assert r["phase3"]["total"] < 30
    assert r["recommendation"]["code"] == "retain"
    assert r["recommendation"]["rule"] == 7


def test_unknown_technology_is_flagged_for_verification(answers):
    answers["programming_language"] = "Delphi 7"
    r = assess(answers)
    lang = next(c for c in r["phase2"]["components"] if c["id"] == "programming_language")
    assert lang["rating"] == "needs_upgrade"
    assert lang["verification_required"]
    assert any("verification required" in x["message"] for x in r["risks"])


def test_safety_critical_ot_flags_migration(answers):
    answers["safety_critical_ot"] = "Yes"
    r = assess(answers)
    assert r["recommendation"]["code"] == "rehost"
    assert any("OT cloud security review" in n for n in r["recommendation"]["notes"])


def test_partial_answers_still_score():
    r = assess({"architecture": "Microservices"})
    assert not r["complete"]
    assert "app_name" in r["missing_required"]
    assert next(d for d in r["phase3"]["dimensions"] if d["id"] == "architecture")["score"] == 15


def test_text_report_has_all_sections(answers):
    text = text_report(assess(answers))
    for heading in ("PHASE 1 – HARD FILTER RESULT", "PHASE 2 – TECH STACK CLOUD SUITABILITY",
                    "PHASE 3 – CLOUD NATIVE SCORE", "6R RECOMMENDATION", "KEY RISKS & FLAGS"):
        assert heading in text
    assert "TOTAL SCORE         : 95/100" in text


def test_example_applications_cover_each_outcome():
    import csv

    from cloudsuit.schema import REPO_ROOT, validate

    with open(REPO_ROOT / "examples" / "sample_applications.csv", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    got = {}
    for row in rows:
        answers = {k: v for k, v in row.items() if v}
        assert validate(answers)[1] == {}, row["app_name"]
        got[row["app_name"]] = assess(answers)["recommendation"]["code"]
    assert got == {
        "Order Portal": "rehost",
        "Legacy HR": "refactor",
        "Old Intranet": "retire",
        "CRM": "replace",
        "Line SCADA": "retain",
        "Quality Portal": "replatform",
    }


def test_on_premise_dependencies(answers):
    assert assess(answers)["on_premise_dependencies"] == []
    answers.update(hardware_dependency="Yes", proximity_to_equipment="No", hardware_details="PLC",
                   latency="Ultra Low", app_status="Retired")
    deps = assess(answers)["on_premise_dependencies"]
    assert [d["id"] for d in deps] == ["hardware", "latency", "decommission"]
    assert deps[0]["detail"] == "PLC" and deps[2]["detail"] == "Retired"
    # "Low" latency is not an on-premise dependency; only Ultra Low is.
    answers["latency"] = "Low"
    assert "latency" not in [d["id"] for d in assess(answers)["on_premise_dependencies"]]


def test_tech_stack_input_checks():
    from cloudsuit.techstack import check

    assert check("operating_system", "Windows Server")["status"] == "missing_version"
    assert check("operating_system", "Windows Server 2019")["status"] == "ok"
    s = check("database", "Postgress 14")
    assert s["status"] == "suggestion" and s["suggestion"] == "PostgreSQL 14"
    assert check("database", "banana 12")["status"] == "unrecognized"
    for ok in (("database", "None"), ("app_server", "None"), ("programming_language", "Go"), ("database", "SQLite")):
        assert check(*ok)["status"] == "ok", ok


def test_additional_info_fields_and_report(answers):
    from cloudsuit.schema import fields

    extra = [f for f in fields().values() if f.get("additional")]
    assert len(extra) == 4 and all(not f["required"] for f in extra)
    assert "application_info_additional_info" not in fields()  # excluded in attributes.yaml
    answers["tech_infrastructure_additional_info"] = "DB version to be confirmed"
    r = assess(answers)
    assert r["additional_info"] == [{"section": "Technical Attributes — Infrastructure", "text": "DB version to be confirmed"}]
    assert "ADDITIONAL INFORMATION" in text_report(r)


def test_cloud_suitability_from_6r(answers):
    from cloudsuit.engine import cloud_suitability

    for code in ("rehost", "replatform", "refactor", "replace"):
        assert cloud_suitability(code)["suitable"], code
    for code in ("retire", "retain"):
        assert cloud_suitability(code) == {"suitable": False, "label": "Not Cloud Suitable"}
    r = assess(answers)
    assert r["application"]["project"] == "ABB Edge China"
    assert "Cloud Suitability Result: Cloud Suitable" in text_report(r)
