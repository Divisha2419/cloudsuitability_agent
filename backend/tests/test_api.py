import csv
import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from cloudsuit import api
from cloudsuit.storage import Store


@pytest.fixture
def client(tmp_path, monkeypatch):
    s = Store(f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setattr(api, "store", lambda: s)
    return TestClient(api.app)


def test_schema_lists_steps_and_sections(client):
    schema = client.get("/api/schema").json()
    assert [s["id"] for s in schema["steps"]] == ["application_info", "business", "technical", "results"]
    assert len(schema["sections"]) == 5


def test_assess_accepts_partial_answers(client):
    r = client.post("/api/assess", json={"answers": {"architecture": "SOA"}}).json()
    assert r["complete"] is False
    assert r["phase3"]["total"] >= 10


def test_save_requires_complete_answers(client):
    r = client.post("/api/assessments", json={"answers": {"app_name": "X"}})
    assert r.status_code == 422
    assert "architecture" in r.json()["detail"]["errors"]


def test_save_list_update_delete(client, answers):
    created = client.post("/api/assessments", json={"answers": answers})
    assert created.status_code == 201
    aid = created.json()["id"]
    assert client.get("/api/assessments").json()[0]["recommendation"] == "rehost"

    answers["operating_system"] = "Windows Server 2012"
    updated = client.put(f"/api/assessments/{aid}", json={"answers": answers}).json()
    assert updated["summary"]["recommendation"] == "replatform"

    assert client.get(f"/api/assessments/{aid}").json()["answers"]["operating_system"] == "Windows Server 2012"
    assert client.delete(f"/api/assessments/{aid}").status_code == 204
    assert client.get(f"/api/assessments/{aid}").status_code == 404


def test_exports(client, answers):
    pdf = client.post("/api/report/pdf", json={"answers": {**answers, "app_name": "A & B <test>"}})
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    xlsx = client.post("/api/report/xlsx", json={"answers": answers})
    assert load_workbook(io.BytesIO(xlsx.content)).sheetnames[0] == "Summary"
    client.post("/api/assessments", json={"answers": answers})
    portfolio = load_workbook(io.BytesIO(client.get("/api/portfolio/export.xlsx").content))
    assert portfolio["Portfolio"]["B2"].value == "Order Portal"


def test_batch_csv_ranks_and_rejects(client, answers):
    good_low = {**answers, "app_name": "Legacy", "architecture": "Monolithic", "operating_system": "Windows Server 2012"}
    bad = {**answers, "app_name": "Broken", "latency": "Very fast"}
    buf = io.StringIO()
    # Mix of label headers (with the required marker) and id headers.
    cols = list(answers)
    w = csv.writer(buf)
    w.writerow(["Application Name (*)" if c == "app_name" else c for c in cols])
    for row in (good_low, answers, bad):
        w.writerow([row[c] for c in cols])
    r = client.post("/api/batch", files={"file": ("apps.csv", buf.getvalue(), "text/csv")}).json()
    assert r["total"] == 3 and r["assessed"] == 2
    assert [x["app_name"] for x in r["ranked"]] == ["Order Portal", "Legacy"]
    assert r["rejected"][0]["row"] == 4 and "latency" in r["rejected"][0]["errors"]
    assert len(client.get("/api/assessments").json()) == 2


def test_batch_xlsx_template_round_trip(client, answers):
    wb = load_workbook(io.BytesIO(client.get("/api/batch/template.xlsx").content))
    ws = wb["Applications"]
    headers = [c.value for c in ws[1]]
    ids = [row[1].value for row in wb["Allowed values"].iter_rows(min_row=2)]
    ws.append([answers.get(fid, "") for fid in ids])
    buf = io.BytesIO()
    wb.save(buf)
    assert headers[0] == "Application Name (*)"
    r = client.post("/api/batch?save=false",
                    files={"file": ("apps.xlsx", buf.getvalue(), "application/octet-stream")}).json()
    assert r["assessed"] == 1 and r["ranked"][0]["saved_id"] is None


def test_batch_rejects_unknown_file_type(client):
    r = client.post("/api/batch", files={"file": ("apps.txt", b"x", "text/plain")})
    assert r.status_code == 400


def test_logo_404_without_file_and_served_with_file(client, tmp_path, monkeypatch):
    monkeypatch.setattr(api, "BRANDING_DIR", tmp_path)  # independent of the real config/branding
    assert client.get("/api/branding/logo").status_code == 404
    assert client.get("/api/branding").json() == {"logo_url": None}
    (tmp_path / "logo.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>")
    r = client.get("/api/branding/logo")
    assert r.status_code == 200 and r.headers["content-type"].startswith("image/svg+xml")
    assert client.get("/api/branding").json() == {"logo_url": "/api/branding/logo"}
