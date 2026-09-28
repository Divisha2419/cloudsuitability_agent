"""FastAPI app: schema, live scoring, saved assessments, exports and batch upload.

Run with:  uvicorn cloudsuit.api:app --reload   (from the backend/ directory)
If frontend/dist exists (after `npm run build`), it is served at /.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import batch, exports
from .engine import assess
from .report import text_report
from .schema import REPO_ROOT, attributes_config, validate
from .storage import Store

app = FastAPI(title="Cloud Suitability Assessment", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@lru_cache
def store() -> Store:
    return Store()


class AnswersIn(BaseModel):
    answers: dict[str, Any]


def _slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", text).strip("_") or "application"


def _download(content: bytes, media_type: str, filename: str) -> Response:
    return Response(content, media_type=media_type,
                    headers={"Content-Disposition": f'attachment; filename="{filename}"'})


def _complete_result(answers: dict) -> dict:
    """Assess answers that must be complete; 422 with field errors otherwise."""
    _, errors = validate(answers)
    if errors:
        raise HTTPException(422, detail={"message": "Some fields need attention", "errors": errors})
    return assess(answers)


# --------------------------------------------------------------------------- schema & scoring


@app.get("/api/schema")
def get_schema() -> dict:
    return attributes_config()


@app.post("/api/assess")
def post_assess(body: AnswersIn) -> dict:
    """Live preview: accepts partial answers and scores what is filled in."""
    return assess(body.answers)


@app.post("/api/validate")
def post_validate(body: AnswersIn) -> dict:
    _, errors = validate(body.answers)
    return {"valid": not errors, "errors": errors}


@app.post("/api/report/text", response_class=PlainTextResponse)
def post_report_text(body: AnswersIn) -> str:
    return text_report(_complete_result(body.answers))


@app.post("/api/report/pdf")
def post_report_pdf(body: AnswersIn) -> Response:
    result = _complete_result(body.answers)
    name = f"cloud_suitability_{_slug(result['application']['name'])}.pdf"
    return _download(exports.assessment_pdf(result), "application/pdf", name)


@app.post("/api/report/xlsx")
def post_report_xlsx(body: AnswersIn) -> Response:
    result = _complete_result(body.answers)
    name = f"cloud_suitability_{_slug(result['application']['name'])}.xlsx"
    return _download(exports.assessment_xlsx(result), XLSX, name)


# --------------------------------------------------------------------------- saved assessments


@app.get("/api/assessments")
def list_assessments() -> list[dict]:
    return [a.summary() for a in store().list()]


@app.post("/api/assessments", status_code=201)
def create_assessment(body: AnswersIn) -> dict:
    result = _complete_result(body.answers)
    row = store().save(result["answers"], result)
    return {"id": row.id, "summary": row.summary()}


@app.get("/api/assessments/{assessment_id}")
def get_assessment(assessment_id: int) -> dict:
    row = store().get(assessment_id)
    if row is None:
        raise HTTPException(404, "Assessment not found")
    return {"id": row.id, "answers": row.answers, "result": row.result}


@app.put("/api/assessments/{assessment_id}")
def update_assessment(assessment_id: int, body: AnswersIn) -> dict:
    result = _complete_result(body.answers)
    row = store().save(result["answers"], result, assessment_id)
    if row is None:
        raise HTTPException(404, "Assessment not found")
    return {"id": row.id, "summary": row.summary()}


@app.delete("/api/assessments/{assessment_id}", status_code=204)
def delete_assessment(assessment_id: int) -> Response:
    if not store().delete(assessment_id):
        raise HTTPException(404, "Assessment not found")
    return Response(status_code=204)


@app.get("/api/portfolio/export.xlsx")
def export_portfolio() -> Response:
    results = [a.result for a in store().list()]
    return _download(exports.portfolio_xlsx(results), XLSX, "cloud_suitability_portfolio.xlsx")


# --------------------------------------------------------------------------- batch


@app.get("/api/batch/template.xlsx")
def batch_template_xlsx() -> Response:
    return _download(exports.batch_template_xlsx(), XLSX, "cloud_suitability_batch_template.xlsx")


@app.get("/api/batch/template.csv")
def batch_template_csv() -> Response:
    return _download(batch.template_csv().encode(), "text/csv", "cloud_suitability_batch_template.csv")


@app.post("/api/batch")
async def post_batch(file: UploadFile = File(...), save: bool = True) -> dict:
    """Assess every row. Complete rows are saved to the portfolio when save=true."""
    try:
        entries = batch.assess_batch(file.filename or "", await file.read())
    except batch.BatchError as exc:
        raise HTTPException(400, str(exc)) from exc
    rows = []
    for e in entries:
        saved_id = None
        if save and not e["errors"]:
            saved_id = store().save(e["result"]["answers"], e["result"]).id
        rows.append({
            "row": e["row"],
            "app_name": e["result"]["application"]["name"],
            "errors": e["errors"],
            "saved_id": saved_id,
            "score": e["result"]["phase3"]["total"],
            "band": e["result"]["phase3"]["band"],
            "phase1": e["result"]["phase1"]["status"],
            "phase2": e["result"]["phase2"]["overall_label"],
            "recommendation": e["result"]["recommendation"]["code"],
            "recommendation_headline": e["result"]["recommendation"]["headline"],
        })
    valid = [r for r in rows if not r["errors"]]
    ranked = sorted(valid, key=lambda r: r["score"], reverse=True)
    return {"total": len(rows), "assessed": len(valid), "ranked": ranked,
            "rejected": [r for r in rows if r["errors"]]}


# --------------------------------------------------------------------------- frontend

DIST = REPO_ROOT / "frontend" / "dist"
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        target = DIST / path
        if path and target.is_file() and DIST in target.resolve().parents:
            return FileResponse(target)
        return FileResponse(DIST / "index.html")
