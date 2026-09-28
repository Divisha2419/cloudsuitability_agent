"""Loads the YAML config and normalises / validates user answers against it."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(os.environ.get("CLOUDSUIT_CONFIG_DIR", REPO_ROOT / "config"))

Answers = dict[str, Any]


def _load(name: str) -> dict:
    with open(CONFIG_DIR / name, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


@lru_cache
def attributes_config() -> dict:
    return _load("attributes.yaml")


@lru_cache
def rubric_config() -> dict:
    return _load("scoring_rubric.yaml")


@lru_cache
def tech_config() -> dict:
    return _load("tech_stack_ratings.yaml")


@lru_cache
def fields() -> dict[str, dict]:
    """All fields keyed by id, in form order, each tagged with its section id."""
    out: dict[str, dict] = {}
    for section in attributes_config()["sections"]:
        for field in section["fields"]:
            out[field["id"]] = {**field, "section": section["id"]}
    return out


def _clean(value: Any) -> str:
    return " ".join(str(value).split()) if value is not None else ""


def _match_option(field: dict, raw: str) -> str | None:
    """Return the option value matching raw by value or label, ignoring case."""
    key = raw.casefold()
    for opt in field["options"]:
        if key in (str(opt["value"]).casefold(), str(opt["label"]).casefold()):
            return str(opt["value"])
    return None


def is_visible(field: dict, answers: Answers) -> bool:
    cond = field.get("show_if")
    if not cond:
        return True
    return answers.get(cond["field"]) in cond["in"]


def normalize(raw_answers: Answers) -> tuple[Answers, dict[str, str]]:
    """Clean raw answers.

    Returns (answers, errors). Select values are mapped to their canonical
    option value; unknown fields are dropped; answers to fields hidden by
    show_if are dropped. Invalid select values are left out and reported.
    """
    answers: Answers = {}
    errors: dict[str, str] = {}
    for fid, field in fields().items():
        raw = _clean(raw_answers.get(fid))
        if not raw:
            continue
        if field["type"] == "select":
            value = _match_option(field, raw)
            if value is None:
                allowed = ", ".join(str(o["value"]) for o in field["options"])
                errors[fid] = f'"{raw}" is not an allowed value ({allowed})'
                continue
            answers[fid] = value
        else:
            answers[fid] = raw
    # Visibility can depend on other answers, so filter after all are mapped.
    answers = {fid: v for fid, v in answers.items() if is_visible(fields()[fid], answers)}
    return answers, errors


def missing_required(answers: Answers) -> list[str]:
    return [
        fid
        for fid, field in fields().items()
        if field.get("required") and is_visible(field, answers) and not answers.get(fid)
    ]


def validate(raw_answers: Answers) -> tuple[Answers, dict[str, str]]:
    """Normalise and report both invalid values and missing required fields."""
    answers, errors = normalize(raw_answers)
    for fid in missing_required(answers):
        errors.setdefault(fid, "This field is required")
    return answers, errors


def option_label(fid: str, value: str | None) -> str:
    if not value:
        return ""
    field = fields().get(fid)
    for opt in (field or {}).get("options", []):
        if str(opt["value"]) == value:
            return str(opt["label"])
    return value
