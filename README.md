# cloudsuitability_agent

This agent assesses how suitable an application is for the cloud, based on the details users give about it.

Application owners work through a short, section-by-section form: application info, business attributes, and technical attributes. The tool then produces a cloud suitability report in three phases:

1. **Hard filters**: automatic disqualifiers, such as decommissioning, hardware tied to physical equipment, a mainframe dependency or ultra-low latency.
2. **Tech stack suitability**: rates the OS, database, programming language and app/web server as Cloud Ready, Needs Upgrade or Not Cloud Suitable.
3. **Cloud Native Score (0–100) and 6R recommendation**: Rehost, Replatform, Refactor, Retire, Replace or Retain.

Features: a live score sidebar, a results dashboard (gauge, colour-coded tech stack table, 6R badge, risks), PDF and Excel export, a saved-assessment portfolio, and batch assessment from a CSV/Excel upload.

The full agent instructions are in [`prompts/system_prompt.md`](prompts/system_prompt.md).

## Running it

Requirements: Python 3.11+ and Node.js 22.12+ (the frontend build tools do not work on older Node versions).

```bash
# Backend (API on http://localhost:8000)
python -m venv .venv && . .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend && uvicorn cloudsuit.api:app --reload

# Frontend, in a second terminal (UI on http://localhost:5173, proxies /api to :8000)
cd frontend && npm install && npm run dev
```

For a single-server setup, run `npm run build` in `frontend/`. Uvicorn then serves the built UI at http://localhost:8000.

Saved assessments go to `data/assessments.db` (SQLite). To use PostgreSQL instead, set `DATABASE_URL` (for example `postgresql+psycopg://user:pass@host/db`) and install a driver such as `psycopg[binary]`.

## Batch assessment

On the **Portfolio** page, download the Excel template, fill in one application per row and upload it. [`examples/sample_applications.csv`](examples/sample_applications.csv) contains six sample applications, one for each 6R outcome.
