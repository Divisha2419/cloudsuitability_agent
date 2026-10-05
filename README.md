# cloudsuitability_agent

This agent assesses how suitable an application is for the cloud, based on the details users give about it.

Application owners work through a short, section-by-section form: application info, business attributes, and technical attributes. The tool then produces a cloud suitability report in three phases:

1. **Hard filters**: automatic disqualifiers, such as decommissioning, hardware tied to physical equipment, a mainframe dependency or ultra-low latency.
2. **Tech stack suitability**: rates the OS, database, programming language and app/web server as Cloud Ready, Needs Upgrade or Not Cloud Suitable.
3. **Cloud Native Score (0–100) and 6R recommendation**: Rehost, Replatform, Refactor, Retire, Replace or Retain.

Features: an assessment readiness side panel (data completeness, tech stack compatibility, on-premise dependencies), a results dashboard (gauge, colour-coded tech stack table, 6R badge, risks), PDF and Excel export, and an Admin page that shows the cloud suitability of every application assessed in a project.

The full agent instructions are in [`prompts/system_prompt.md`](prompts/system_prompt.md).

## Running it

Requirement: Python 3.11+ (Node.js is **not** needed just to run the app — the built web UI is committed in `frontend/dist/`).

```bash
python -m venv .venv
. .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r backend/requirements-dev.txt
cd backend && uvicorn cloudsuit.api:app
```

Open http://localhost:8000.

The UI works in Chrome/Edge 109+ and Firefox 115+, so it also runs on Windows 7/8.1.

### Changing the web UI (developers only)

This needs Node.js 22.12+ (Windows 10 or newer).

```bash
cd frontend && npm install
npm run dev      # http://localhost:5173, proxies /api to the backend on :8000
npm run build    # rebuilds frontend/dist — commit it together with your source changes
```

Saved assessments go to `data/assessments.db` (SQLite). To use PostgreSQL instead, set `DATABASE_URL` (for example `postgresql+psycopg://user:pass@host/db`) and install a driver such as `psycopg[binary]`.

## Logo

To show the official logo at the top left, put the file in `config/branding/` as `logo.svg` or `logo.png`, then refresh the browser. Without it, the text wordmark is shown.

## User and Admin

- **User**: fill in the assessment. Clicking **Generate report** saves it under the chosen Project / Client. Assessing the same Application ID again in the same project replaces the earlier result.
- **Admin**: log in (default username `admin`, password `admin`, set in `config/admin.yaml`), select a project and see a summary chart plus a table of all its applications. Click an application to open its full report. Applications can be deleted and the table exported to Excel. Projects with more than 5 applications also get a provisional migration wave roadmap; the wave rules and timeframes are in `config/migration_waves.yaml`.

## Projects

The Project / Client list is in **`config/projects.yaml`**. Add a line per project and restart the app.

## Where the data is stored

Completed assessments are saved in a SQLite database file, `data/assessments.db`. Everyone who uses the same running copy of the tool shares this database. To view it directly, open the file with DB Browser for SQLite. To use PostgreSQL or SQL Server instead, set `DATABASE_URL`.
