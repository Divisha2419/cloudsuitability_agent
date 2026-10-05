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
config/projects.yaml            Project / Client dropdown options (first screen and Admin page)
config/migration_waves.yaml     Admin wave roadmap: wave rules (6R + criticality), timeframes, min_applications
config/admin.yaml               Admin page username/password (plain text; prototype only — committed on purpose)
config/branding/                Optional logo.svg/.png shown top-left (falls back to the text wordmark)
backend/cloudsuit/              Python package (FastAPI)
  schema.py      loads config; normalises answers (select accepts value or label); validation; show_if
  techstack.py   Phase 2 rating of free-text OS/DB/language/server, plus input checks (missing version, spelling, unrecognised)
  engine.py      phase1 / phase2 / phase3 / recommend (6R) / risks / assess()
  report.py      text report in the instructions' "Output Report Format"
  exports.py     PDF (reportlab) and Excel (openpyxl) exports; Admin project table export
  storage.py     SQLAlchemy store; upsert by (project, app_id); adds missing columns to older SQLite files
  waves.py       provisional migration wave roadmap for a project's Admin rows (first matching wave wins)
  auth.py        Admin login: in-memory bearer tokens (8 h); credentials from config/admin.yaml
  api.py         HTTP API (public: schema/assess/submit/reports; /api/admin/*: login-protected); serves frontend/dist
backend/tests/                  pytest suite (engine rules + API)
frontend/                       React 19 + TypeScript + Vite + Tailwind v3 UI (built output committed in frontend/dist)
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

- **Config drives everything.** The UI fetches `config/attributes.yaml` through `GET /api/schema` and renders forms from it. Validation is built from the same file; `options_from: projects` fills a select from `config/projects.yaml`, and `widget: dropdown` renders a select as a dropdown list instead of option buttons. To add or change an attribute, edit the YAML. Code changes are only needed when the attribute feeds scoring or rules.
- **Scoring runs only on the backend.** The Assessment Readiness side panel (`frontend/src/components/ReadinessPanel.tsx`) calls `POST /api/assess` (debounced) with partial answers and shows three parts: Data Completeness (bars per `completeness_groups` in `attributes.yaml`, counted on the client), Technology Stack Compatibility (Phase 2 ratings from the backend), and On-Premise Dependencies (`engine.on_premise_dependencies()`). `frontend/src/form.ts` only mirrors `show_if` and required checks so validation feels instant.
- **The 6R rules** live in `engine.recommend()` in the priority order from the instructions (first match wins). Rule `0` is a fallback for a gap in the specified rules.
- **Fields marked `origin: added`** in `attributes.yaml` (coupling, state, mainframe, proximity, SaaS equivalent, safety-critical OT) were added to feed the scoring, hard-filter and behaviour rules. They are now listed in the instructions' intake tables too. The UI labels them "scoring input".
- Hidden fields (`show_if` not met) are dropped from answers before scoring and saving.
- **User / Admin.** `App.tsx` has two views. User: "Generate report" calls `POST /api/assessments`, which saves (replacing the same project + Application ID). Admin (`components/Admin.tsx`): login → project → summary (donut + 6R bars) → table → wave roadmap (only when more than 5 apps, `waves.roadmap()`) → full report via `Results` with `onBack`. The report page has no text-report section (removed on request); `/api/report/text` still exists for the API. "Cloud Suitable" comes from `cloud_suitability` in `scoring_rubric.yaml` (Rehost/Replatform/Refactor/Replace); the score is only shown for suitable apps. Batch upload was removed on purpose.
- **Additional Information boxes** are not in the YAML sections: `schema.attributes_config()` appends a `<section>_additional_info` textarea (`additional: true`) to every section when `additional_info.enabled` is true, except those in `additional_info.exclude_sections` (currently `application_info`). They are saved and exported (`result.additional_info`) but excluded from Data Completeness.
- **Tech-stack input checks** use the `products` catalogue in `tech_stack_ratings.yaml` (canonical name, aliases, `needs_version`). `techstack.check()` returns `ok | missing_version | suggestion | unrecognized` per component in `phase2.components[].check`. All messages show inline under the field: suggestions/unrecognised while typing, missing versions once the user leaves the field (`touched` in `App.tsx`). Next is blocked once while any are open (clicking Next again with the same entries continues). Spelling suggestions use difflib with a 0.8 cutoff, aliases of 4+ chars and the same first letter.
- **Attribute explanations** (`help` in the YAML) are shown under each label, not as tooltips.
- **`frontend/dist/` is committed on purpose.** The user runs the app on Windows 8.1, which cannot install Node.js 22. After any change under `frontend/src`, run `npm run build` and commit `frontend/dist` in the same commit.
- **Visual style** follows the Deloitte report deck: palette in `frontend/tailwind.config.js` (`brand` greens, `dblue`, `teal`, `ink` greys), Calibri, and dark-green header bands via `Card`. The logo is `config/branding/logo.png` (the official Deloitte logo), shown by `DeloitteLogo` in `ui.tsx`, which falls back to a text wordmark if the file is missing. Red (`critical`) is only for "not cloud compatible" and high risks. See UI requirement 10 in the instructions.
- **Browser support: Chrome/Edge 109 and Firefox 115** (the last versions on Windows 7/8.1). This is why the project uses Tailwind v3 rather than v4 (v4 needs oklch, `@property` and similar) and why `vite.config.ts` sets `build.target`. Avoid CSS or JS features newer than those browsers.

## Working conventions

- Keep `README.md` user-facing (what the agent does and how to use it) and keep this file focused on guidance for development.
- When changing rules or config, add or adjust a test in `backend/tests/` and keep `examples/sample_applications.csv` passing.
- Do not commit secrets such as API keys or cloud credentials. Load them from environment variables.
