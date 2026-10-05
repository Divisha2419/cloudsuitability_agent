"""Saved assessments, read by the Admin page.

Uses SQLAlchemy so the default SQLite file can be swapped for PostgreSQL or
SQL Server by setting DATABASE_URL (e.g. postgresql+psycopg://user:pass@host/db).

An application is identified by (project, Application ID): assessing the same
Application ID again in the same project replaces the earlier result.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, func, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .engine import cloud_suitability
from .schema import REPO_ROOT

UNASSIGNED = "Unassigned"


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project: Mapped[str] = mapped_column(String(255), default="", index=True)
    app_name: Mapped[str] = mapped_column(String(255))
    app_id: Mapped[str] = mapped_column(String(255), default="")
    answers: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    def row(self) -> dict:
        """One line of the Admin table."""
        r = self.result
        rec = r["recommendation"]
        suitability = cloud_suitability(rec["code"])
        return {
            "id": self.id,
            "project": self.project or UNASSIGNED,
            "app_id": self.app_id,
            "app_name": self.app_name,
            "suitable": suitability["suitable"],
            "suitability": suitability["label"],
            "recommendation": rec["code"],
            "recommendation_headline": rec["headline"],
            # The score is only reported for cloud-suitable applications.
            "score": r["phase3"]["total"] if suitability["suitable"] else None,
            "rationale": rec["rationale"][:3],
            "updated_at": self.updated_at.isoformat(),
        }


def _default_url() -> str:
    data_dir = REPO_ROOT / "data"
    data_dir.mkdir(exist_ok=True)
    return f"sqlite:///{data_dir / 'assessments.db'}"


class Store:
    def __init__(self, url: str | None = None):
        url = url or os.environ.get("DATABASE_URL") or _default_url()
        kwargs = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
        self.engine = create_engine(url, **kwargs)
        Base.metadata.create_all(self.engine)
        self._upgrade()
        self._session = sessionmaker(self.engine, expire_on_commit=False)

    def _upgrade(self) -> None:
        """Add columns introduced after a database was first created (e.g. project)."""
        columns = {c["name"] for c in inspect(self.engine).get_columns("assessments")}
        if "project" not in columns:
            with self.engine.begin() as conn:
                conn.execute(text("ALTER TABLE assessments ADD COLUMN project VARCHAR(255) DEFAULT ''"))

    def session(self) -> Session:
        return self._session()

    def upsert(self, answers: dict, result: dict) -> Assessment:
        """Save an assessment, replacing an earlier one with the same project + Application ID."""
        app = result["application"]
        with self.session() as s:
            row = None
            if app["id"]:
                row = s.scalars(
                    select(Assessment).where(Assessment.project == app["project"], Assessment.app_id == app["id"])
                ).first()
            row = row or Assessment()
            row.project = app["project"]
            row.app_name = app["name"]
            row.app_id = app["id"]
            row.answers = answers
            row.result = result
            row.updated_at = _now()
            s.add(row)
            s.commit()
            return row

    def get(self, assessment_id: int) -> Assessment | None:
        with self.session() as s:
            return s.get(Assessment, assessment_id)

    def list(self, project: str | None = None) -> list[Assessment]:
        """Assessments ordered by Application ID; project=None lists all,
        project="Unassigned" lists those saved before projects existed."""
        with self.session() as s:
            q = select(Assessment)
            if project is not None:
                q = q.where(Assessment.project == ("" if project == UNASSIGNED else project))
            return list(s.scalars(q.order_by(Assessment.app_id, Assessment.app_name)))

    def project_counts(self) -> dict[str, int]:
        with self.session() as s:
            rows = s.execute(select(Assessment.project, func.count()).group_by(Assessment.project)).all()
            return {(p or UNASSIGNED): n for p, n in rows}

    def delete(self, assessment_id: int) -> bool:
        with self.session() as s:
            row = s.get(Assessment, assessment_id)
            if row is None:
                return False
            s.delete(row)
            s.commit()
            return True
