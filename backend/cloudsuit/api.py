"""FastAPI app: schema, live scoring, submitting assessments, exports and the Admin API.

Run with:  uvicorn cloudsuit.api:app --reload   (from the backend/ directory)
If frontend/dist exists (after `npm run build`), it is served at /.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import auth, exports, waves
from .engine import assess
from .report import text_report
from .schema import CONFIG_DIR, REPO_ROOT, attributes_config, projects, validate
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


# --------------------------------------------------------------------------- user: submit


@app.get("/api/projects")
def get_projects() -> list[str]:
    return projects()


@app.post("/api/assessments", status_code=201)
def submit_assessment(body: AnswersIn) -> dict:
    """Save a completed assessment ("Generate report"). Re-assessing the same
    Application ID in the same project replaces the earlier result."""
    result = _complete_result(body.answers)
    row = store().upsert(result["answers"], result)
    return {"id": row.id, "result": result}


# --------------------------------------------------------------------------- admin


class LoginIn(BaseModel):
    username: str
    password: str


@app.post("/api/admin/login")
def admin_login(body: LoginIn) -> dict:
    token = auth.login(body.username, body.password)
    if token is None:
        raise HTTPException(401, "Incorrect username or password")
    return {"token": token}


@app.post("/api/admin/logout", status_code=204)
def admin_logout(token: str = Depends(auth.require_admin)) -> Response:
    auth.logout(token)
    return Response(status_code=204)


@app.get("/api/admin/projects", dependencies=[Depends(auth.require_admin)])
def admin_projects() -> list[dict]:
    """Configured projects plus any others found in the database (e.g. "Unassigned"), with counts."""
    counts = store().project_counts()
    names = projects() + sorted(p for p in counts if p not in projects())
    return [{"name": p, "count": counts.get(p, 0)} for p in names]


def _project_rows(project: str) -> list[dict]:
    return [{"s_no": i, **a.row()} for i, a in enumerate(store().list(project), 1)]


@app.get("/api/admin/assessments", dependencies=[Depends(auth.require_admin)])
def admin_assessments(project: str) -> dict:
    rows = _project_rows(project)
    six_r: dict[str, int] = {}
    for r in rows:
        six_r[r["recommendation"]] = six_r.get(r["recommendation"], 0) + 1
    suitable = sum(r["suitable"] for r in rows)
    return {
        "project": project,
        "total": len(rows),
        "suitable": suitable,
        "not_suitable": len(rows) - suitable,
        "six_r": six_r,
        "rows": rows,
        "roadmap": waves.roadmap(rows),
    }


@app.get("/api/admin/assessments/{assessment_id}", dependencies=[Depends(auth.require_admin)])
def admin_assessment(assessment_id: int) -> dict:
    row = store().get(assessment_id)
    if row is None:
        raise HTTPException(404, "Assessment not found")
    # Re-assess so older saved results pick up fields added since (e.g. cloud_suitability).
    return {"id": row.id, "answers": row.answers, "result": assess(row.answers)}


@app.delete("/api/admin/assessments/{assessment_id}", status_code=204, dependencies=[Depends(auth.require_admin)])
def admin_delete(assessment_id: int) -> Response:
    if not store().delete(assessment_id):
        raise HTTPException(404, "Assessment not found")
    return Response(status_code=204)


@app.get("/api/admin/export.xlsx", dependencies=[Depends(auth.require_admin)])
def admin_export(project: str) -> Response:
    rows = _project_rows(project)
    content = exports.project_xlsx(project, rows, waves.roadmap(rows))
    return _download(content, XLSX, f"cloud_suitability_{_slug(project)}.xlsx")


# --------------------------------------------------------------------------- branding

BRANDING_DIR = CONFIG_DIR / "branding"
LOGO_TYPES = {".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def _logo_file() -> tuple[Path, str] | None:
    for ext, media in LOGO_TYPES.items():
        path = BRANDING_DIR / f"logo{ext}"
        if path.is_file():
            return path, media
    return None


@app.get("/api/branding")
def branding() -> dict:
    """Tells the UI whether a logo file was dropped into config/branding/."""
    return {"logo_url": "/api/branding/logo" if _logo_file() else None}


@app.get("/api/branding/logo")
def branding_logo() -> FileResponse:
    """The logo file in config/branding/ (logo.svg / .png / .jpg); 404 if none."""
    found = _logo_file()
    if found is None:
        raise HTTPException(404, "No logo configured")
    return FileResponse(found[0], media_type=found[1], headers={"Cache-Control": "no-cache"})


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
