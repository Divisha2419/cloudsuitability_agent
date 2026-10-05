import { type FormEvent, useEffect, useState } from "react";
import { ApiError, adminToken, api, download, slug } from "../api";
import type { AdminRow, Answers, ProjectSummary, Result, Roadmap, SixR, Wave } from "../types";
import Results from "./Results";
import { Button, Card, RatingPill, SIX_R_STYLE, SixRBadge } from "./ui";

// Admin page: log in → pick a project → summary + applications table →
// click a row for the full report (with Back).

const SIX_R_ORDER: SixR[] = ["rehost", "replatform", "refactor", "replace", "retain", "retire"];
const SIX_R_LABEL: Record<SixR, string> = {
  rehost: "Rehost",
  replatform: "Replatform",
  refactor: "Refactor",
  replace: "Replace",
  retain: "Retain",
  retire: "Retire",
};

const SUITABLE_COLOR = "#26890d"; // Deloitte green
const NOT_SUITABLE_COLOR = "#005587"; // Deloitte dark blue (not red: "not suitable" is a disposition, not an error)

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(!!adminToken.get());

  function logout() {
    api.admin.logout().catch(() => {});
    adminToken.set(null);
    setLoggedIn(false);
  }

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;
  return <Portal onLogout={logout} onSessionExpired={() => (adminToken.set(null), setLoggedIn(false))} />;
}

// --------------------------------------------------------------------------- login

function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await api.admin.login(username, password);
      adminToken.set(token);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded border border-ink-line bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-600";
  return (
    <div className="mx-auto max-w-md">
      <Card title="Admin login">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-[15px] text-ink-muted">Log in to view the assessed applications of each project.</p>
          <div>
            <label htmlFor="admin-user" className="text-[15px] font-semibold text-ink">
              Username
            </label>
            <input id="admin-user" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} className={`${input} mt-1`} />
          </div>
          <div>
            <label htmlFor="admin-pass" className="text-[15px] font-semibold text-ink">
              Password
            </label>
            <input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${input} mt-1`}
            />
          </div>
          {error && (
            <p role="alert" className="rounded border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-[#7a4700]">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !username || !password} className="w-full">
            {busy ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------- portal

function Portal({ onLogout, onSessionExpired }: { onLogout: () => void; onSessionExpired: () => void }) {
  const [projects, setProjects] = useState<{ name: string; count: number }[] | null>(null);
  const [project, setProject] = useState("");
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [detail, setDetail] = useState<{ result: Result; answers: Answers } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Any admin call that comes back 401 means the session expired (e.g. the app restarted).
  function handle(err: unknown) {
    if (err instanceof ApiError && err.status === 401) onSessionExpired();
    else setError(err instanceof Error ? err.message : String(err));
  }

  useEffect(() => {
    api.admin.projects().then(setProjects).catch(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadProject(name: string) {
    setProject(name);
    setSummary(null);
    setError(null);
    if (name) api.admin.project(name).then(setSummary).catch(handle);
  }

  async function open(row: { id: number }) {
    try {
      const d = await api.admin.get(row.id);
      setDetail({ result: d.result, answers: d.answers });
      window.scrollTo({ top: 0 });
    } catch (err) {
      handle(err);
    }
  }

  async function remove(row: AdminRow) {
    if (!confirm(`Are you sure you want to delete "${row.app_name}" (${row.app_id || "no ID"}) from ${project}?\n\nThis cannot be undone.`)) return;
    try {
      await api.admin.remove(row.id);
      loadProject(project);
      api.admin.projects().then(setProjects).catch(handle);
    } catch (err) {
      handle(err);
    }
  }

  if (detail) return <Results result={detail.result} answers={detail.answers} onBack={() => setDetail(null)} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-ink">Admin — Project Status</h1>
          <p className="mt-1 text-[15px] text-ink-muted">Select a project to see the cloud suitability of its assessed applications.</p>
        </div>
        <Button variant="secondary" onClick={onLogout}>
          Log out
        </Button>
      </div>

      <div className="rounded-md border border-ink-line bg-white px-5 py-4 shadow-sm">
        <label htmlFor="project" className="text-[15px] font-semibold text-ink">
          Project / Client
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            id="project"
            value={project}
            onChange={(e) => loadProject(e.target.value)}
            className="min-w-[280px] rounded border border-ink-line bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand-600"
          >
            <option value="">Select a project…</option>
            {(projects ?? []).map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} ({p.count} application{p.count === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          {summary && summary.total > 0 && (
            <Button
              variant="secondary"
              onClick={() =>
                api.admin
                  .exportXlsx(project)
                  .then((b) => download(b, `cloud_suitability_${slug(project)}.xlsx`))
                  .catch(handle)
              }
            >
              Export to Excel
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-[#7a4700]">{error}</p>}

      {project && !summary && !error && <p className="text-sm text-ink-muted">Loading…</p>}

      {summary && summary.total === 0 && (
        <Card>
          <p className="text-[15px] text-ink-muted">No applications have been assessed for {project} yet.</p>
        </Card>
      )}

      {summary && summary.total > 0 && (
        <>
          <SummaryCard summary={summary} />
          <ApplicationsTable rows={summary.rows} onOpen={open} onDelete={remove} />
          {summary.roadmap ? (
            <WaveRoadmap roadmap={summary.roadmap} onOpen={open} />
          ) : (
            <p className="text-xs text-ink-muted">A provisional migration wave roadmap is shown once more than 5 applications are assessed in a project.</p>
          )}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- summary card

function SummaryCard({ summary }: { summary: ProjectSummary }) {
  const maxSixR = Math.max(1, ...Object.values(summary.six_r).map((n) => n ?? 0));
  return (
    <Card title={`${summary.project} — Summary`}>
      <div className="grid gap-8 md:grid-cols-[180px_1fr_1fr]">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-brand-700">Total applications</p>
          <p className="mt-1 text-5xl font-bold text-ink">{summary.total}</p>
          <p className="mt-1 text-sm text-ink-muted">assessed in this project</p>
        </div>

        <div>
          <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-brand-700">Cloud suitability</p>
          <div className="flex items-center gap-5">
            <Donut suitable={summary.suitable} notSuitable={summary.not_suitable} />
            <ul className="space-y-2 text-sm">
              <LegendItem color={SUITABLE_COLOR} label="Cloud Suitable" n={summary.suitable} total={summary.total} />
              <LegendItem color={NOT_SUITABLE_COLOR} label="Not Cloud Suitable" n={summary.not_suitable} total={summary.total} />
            </ul>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[13px] font-bold uppercase tracking-wide text-brand-700">6R disposition</p>
          <ul className="space-y-1.5">
            {SIX_R_ORDER.map((code) => {
              const n = summary.six_r[code] ?? 0;
              return (
                <li key={code} className="grid grid-cols-[84px_1fr_24px] items-center gap-2 text-[13px]" title={`${SIX_R_LABEL[code]}: ${n}`}>
                  <span className="text-ink">{SIX_R_LABEL[code]}</span>
                  <span className="h-3 rounded-sm bg-[var(--color-track)]">
                    {n > 0 && <span className={`block h-3 rounded-sm ${SIX_R_STYLE[code].split(" ")[0]}`} style={{ width: `${(n / maxSixR) * 100}%` }} />}
                  </span>
                  <span className="text-right font-semibold tabular-nums text-ink">{n}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function LegendItem({ color, label, n, total }: { color: string; label: string; n: number; total: number }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: color }} />
      <span className="text-ink">{label}</span>
      <span className="font-bold tabular-nums text-ink">{n}</span>
      <span className="text-ink-muted">({total ? Math.round((n / total) * 100) : 0}%)</span>
    </li>
  );
}

/** Two-segment donut; the hole shows the suitable share. */
function Donut({ suitable, notSuitable }: { suitable: number; notSuitable: number }) {
  const total = suitable + notSuitable;
  const r = 40;
  const c = 2 * Math.PI * r;
  const share = total ? suitable / total : 0;
  const gap = suitable && notSuitable ? 2 : 0; // small surface gap between the two segments
  return (
    <svg viewBox="0 0 100 100" width={112} height={112} role="img" aria-label={`${suitable} of ${total} applications cloud suitable`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-track)" strokeWidth="14" />
      {notSuitable > 0 && (
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={NOT_SUITABLE_COLOR} strokeWidth="14"
          strokeDasharray={`${Math.max(0, (1 - share) * c - gap)} ${c}`}
          strokeDashoffset={-share * c}
          transform="rotate(-90 50 50)"
        >
          <title>Not Cloud Suitable: {notSuitable}</title>
        </circle>
      )}
      {suitable > 0 && (
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={SUITABLE_COLOR} strokeWidth="14"
          strokeDasharray={`${Math.max(0, share * c - gap)} ${c}`}
          transform="rotate(-90 50 50)"
        >
          <title>Cloud Suitable: {suitable}</title>
        </circle>
      )}
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-black text-[20px] font-bold">
        {Math.round(share * 100)}%
      </text>
    </svg>
  );
}

// --------------------------------------------------------------------------- table

function ApplicationsTable({ rows, onOpen, onDelete }: { rows: AdminRow[]; onOpen: (r: AdminRow) => void; onDelete: (r: AdminRow) => void }) {
  const th = "px-3 py-2.5 text-left text-[13px] font-bold text-white";
  return (
    <section className="overflow-hidden rounded-md border border-ink-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-brand-700">
            <tr>
              <th className={`${th} w-14`}>S.No</th>
              <th className={th}>Application ID</th>
              <th className={th}>Application Name</th>
              <th className={th}>Cloud Suitability Result</th>
              <th className={th}>6R</th>
              <th className={`${th} text-right`}>Cloud Native Score</th>
              <th className={`${th} w-[34%]`}>Rationale</th>
              <th className={th}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                className="cursor-pointer border-b border-ink-line align-top transition hover:bg-brand-50"
                title="Open the full report"
              >
                <td className="px-3 py-3 tabular-nums text-ink-muted">{r.s_no}</td>
                <td className="px-3 py-3 font-semibold text-ink">{r.app_id || "—"}</td>
                <td className="px-3 py-3">
                  <button type="button" className="text-left font-semibold text-brand-700 hover:underline" onClick={() => onOpen(r)}>
                    {r.app_name}
                  </button>
                </td>
                <td className="px-3 py-3">
                  <RatingPill rating={r.suitable ? "cloud_ready" : "na"} label={r.suitability} />
                </td>
                <td className="px-3 py-3">
                  <SixRBadge code={r.recommendation} headline={r.recommendation_headline} />
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums text-ink">{r.score ?? ""}</td>
                <td className="px-3 py-3 text-[13px] leading-snug text-ink-muted">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {r.rationale.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    variant="danger"
                    className="px-2 py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(r);
                    }}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-xs text-ink-muted">Click an application to open its full report.</p>
    </section>
  );
}

// --------------------------------------------------------------------------- wave roadmap

function WaveRoadmap({ roadmap, onOpen }: { roadmap: Roadmap; onOpen: (a: { id: number }) => void }) {
  const out = roadmap.out_of_scope;
  return (
    <Card title="Provisional cloud migration wave roadmap">
      <p className="mb-5 text-[13px] text-ink-muted">
        Waves are derived from each application's 6R recommendation and business criticality (configured in
        config/migration_waves.yaml). Validate dependencies, change freezes and landing-zone readiness with the client before
        committing dates.
      </p>
      <div className="overflow-x-auto pb-1">
        <ol className="flex gap-3">
          {roadmap.waves.map((w, i) => (
            <WaveColumn key={w.name} wave={w} step={i + 1} onOpen={onOpen} />
          ))}
          {out.applications.length > 0 && <WaveColumn wave={out} onOpen={onOpen} muted />}
        </ol>
      </div>
    </Card>
  );
}

function WaveColumn({ wave, step, muted = false, onOpen }: { wave: Wave; step?: number; muted?: boolean; onOpen: (a: { id: number }) => void }) {
  return (
    <li className={`flex min-w-[190px] flex-1 basis-0 flex-col rounded-md border ${muted ? "border-dashed border-ink-line bg-slate-50" : "border-ink-line bg-white"}`}>
      <div className={`rounded-t-md px-4 py-3 ${muted ? "bg-slate-100" : "bg-brand-50"}`}>
        <div className="flex items-center gap-2">
          {step !== undefined && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{step}</span>
          )}
          <h4 className={`text-[14px] font-bold leading-tight ${muted ? "text-ink-muted" : "text-ink"}`}>{wave.name}</h4>
        </div>
        {wave.timeframe && <p className="mt-1 text-xs font-semibold text-brand-700">{wave.timeframe}</p>}
        <p className="mt-1 text-xs leading-snug text-ink-muted">{wave.description}</p>
        <p className="mt-2 text-xs font-semibold text-ink">
          {wave.applications.length} application{wave.applications.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="space-y-2 p-3">
        {wave.applications.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="w-full rounded border border-ink-line bg-white px-3 py-2 text-left transition hover:border-brand-600 hover:bg-brand-50"
              title="Open the full report"
            >
              <span className="block text-[13px] font-semibold text-ink">
                {a.app_id ? `${a.app_id} · ` : ""}
                {a.app_name}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <SixRBadge code={a.recommendation} headline={SIX_R_LABEL[a.recommendation]} />
                <span className="text-[11px] text-ink-muted">{a.criticality || "Criticality n/a"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  );
}
