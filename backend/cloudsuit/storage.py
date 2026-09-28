"""Saved assessments (multi-application / portfolio mode).

Uses SQLAlchemy so the default SQLite file can be swapped for PostgreSQL by
setting DATABASE_URL (e.g. postgresql+psycopg://user:pass@host/db).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .schema import REPO_ROOT


class Base(DeclarativeBase):
    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    app_name: Mapped[str] = mapped_column(String(255))
    app_id: Mapped[str] = mapped_column(String(255), default="")
    answers: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)

    def summary(self) -> dict:
        r = self.result
        return {
            "id": self.id,
            "app_name": self.app_name,
            "app_id": self.app_id,
            "manager": r["application"]["manager"],
            "score": r["phase3"]["total"],
            "band": r["phase3"]["band"],
            "phase1": r["phase1"]["status"],
            "phase2": r["phase2"]["overall_label"],
            "phase2_overall": r["phase2"]["overall"],
            "recommendation": r["recommendation"]["code"],
            "recommendation_headline": r["recommendation"]["headline"],
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
        self._session = sessionmaker(self.engine, expire_on_commit=False)

    def session(self) -> Session:
        return self._session()

    def save(self, answers: dict, result: dict, assessment_id: int | None = None) -> Assessment | None:
        with self.session() as s:
            row = s.get(Assessment, assessment_id) if assessment_id else Assessment()
            if row is None:
                return None
            row.app_name = result["application"]["name"]
            row.app_id = result["application"]["id"]
            row.answers = answers
            row.result = result
            s.add(row)
            s.commit()
            return row

    def get(self, assessment_id: int) -> Assessment | None:
        with self.session() as s:
            return s.get(Assessment, assessment_id)

    def list(self) -> list[Assessment]:
        with self.session() as s:
            return list(s.scalars(select(Assessment).order_by(Assessment.updated_at.desc())))

    def delete(self, assessment_id: int) -> bool:
        with self.session() as s:
            row = s.get(Assessment, assessment_id)
            if row is None:
                return False
            s.delete(row)
            s.commit()
            return True
