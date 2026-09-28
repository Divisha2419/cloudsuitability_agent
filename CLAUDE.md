# CLAUDE.md

This file gives Claude Code (claude.ai/code) guidance for working in this repository.

## Project overview

`cloudsuitability_agent` assesses how suitable an application is for the cloud. Users fill in 30–40 business and technical attributes per application. A three-phase engine then produces a report: hard filters, tech stack ratings, and a Cloud Native Score with a 6R recommendation.

**The source of truth for the behaviour is [`prompts/system_prompt.md`](prompts/system_prompt.md)**, a verbatim copy of the agent instructions. Read it before changing scoring, rules or the UI. If code and instructions disagree, raise it with the user rather than silently picking one.

## Layout

```
prompts/system_prompt.md        Agent instructions (verbatim, do not edit without the user)
config/attributes.yaml          All intake fields: steps, sections, types, options, required, tooltips, show_if
config/tech_stack_ratings.yaml  Phase 2 lookup tables as ordered regex rules
config/scoring_rubric.yaml      Phase 3 weights/points, score bands, 6R definitions and next steps
backend/cloudsuit/              Python package (FastAPI)
  schema.py      loads config; normalises answers (select accepts value or label); validation; show_if
  techstack.py   Phase 2 rating of free-text OS/DB/language/server
  engine.py      phase1 / phase2 / phase3 / recommend (6R) / risks / assess()
  report.py      text report in the instructions' "Output Report Format"
  exports.py     PDF (reportlab) and Excel (openpyxl) exports; batch upload template
  batch.py       CSV/XLSX batch upload parsing
  storage.py     SQLAlchemy store for saved assessments (SQLite default, DATABASE_URL for Postgres)
  api.py         HTTP API; also serves frontend/dist when built
backend/tests/                  pytest suite (engine rules + API)
frontend/                       React 19 + TypeScript + Vite + Tailwind v4 UI
examples/sample_applications.csv  one application per 6R outcome (also used by a test)
```

## Commands

```bash
# one-time setup
python -m venv .venv && .venv/bin/pip install -r backend/requirements-dev.txt
(cd frontend && npm install)

# backend tests (run from backend/)
cd backend && ../.venv/bin/pytest -q

# run API (from backend/) — http://localhost:8000
../.venv/bin/uvicorn cloudsuit.api:app --reload

# frontend dev server (proxies /api to :8000) — http://localhost:5173
cd frontend && npm run dev

# frontend typecheck + production build (output in frontend/dist, served by the API)
cd frontend && npm run build
```

## How things fit together

- **Config drives everything.** The UI fetches `config/attributes.yaml` through `GET /api/schema` and renders forms from it. The batch template and validation are built from the same file. To add or change an attribute, edit the YAML. Code changes are only needed when the attribute feeds scoring or rules.
- **Scoring runs only on the backend.** The live score sidebar calls `POST /api/assess` (debounced) with partial answers. `frontend/src/form.ts` only mirrors `show_if` and required checks so validation feels instant.
- **The 6R rules** live in `engine.recommend()` in the priority order from the instructions (first match wins). Rule `0` is a fallback for a gap in the specified rules.
- **Fields marked `origin: added`** in `attributes.yaml` (coupling, state, mainframe, proximity, SaaS equivalent, safety-critical OT) are not in the intake steps of the instructions. They are needed by its scoring, hard-filter or behaviour rules. The UI labels them "scoring input".
- Hidden fields (`show_if` not met) are dropped from answers before scoring and saving.

## Working conventions

- Keep `README.md` user-facing (what the agent does and how to use it) and keep this file focused on guidance for development.
- When changing rules or config, add or adjust a test in `backend/tests/` and keep `examples/sample_applications.csv` passing.
- Do not commit secrets such as API keys or cloud credentials. Load them from environment variables.
