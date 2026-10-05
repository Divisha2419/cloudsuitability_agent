import { type ReactNode, useState } from "react";
import { api, download, slug } from "../api";
import type { Answers, Result, SixR } from "../types";
import Gauge from "./Gauge";
import { Button, Card, RatingPill, SixRBadge } from "./ui";

interface Props {
  result: Result;
  answers: Answers;
  /** Admin: return to the project table. */
  onBack?: () => void;
  /** User: go back to the form to change answers (re-submitting replaces the saved result). */
  onEdit?: () => void;
  /** User: start a new assessment. */
  onNew?: () => void;
  /** Shown above the report, e.g. "Saved to project ABB Edge China". */
  notice?: ReactNode;
}

const SEVERITY = {
  high: { icon: "✕", cls: "bg-critical/10 text-red-800 ring-critical/30", label: "High" },
  medium: { icon: "!", cls: "bg-warning/15 text-amber-900 ring-warning/50", label: "Medium" },
  low: { icon: "i", cls: "bg-slate-100 text-slate-700 ring-slate-300", label: "Low" },
};

const SIX_R_ORDER: SixR[] = ["rehost", "replatform", "refactor", "retire", "replace", "retain"];

export default function Results({ result, answers, onBack, onEdit, onNew, notice }: Props) {
  const { application: app, phase1, phase2, phase3, recommendation: rec, risks } = result;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const base = `cloud_suitability_${slug(app.name)}`;

  return (
    <div className="space-y-6">
      {onBack && (
        <Button variant="secondary" onClick={onBack}>
          ← Back to applications
        </Button>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {app.project && <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{app.project}</p>}
          <h2 className="text-2xl font-semibold text-slate-900">{app.name}</h2>
          <p className="text-sm text-slate-500">
            {app.id && <>ID {app.id} · </>}Assessed by {app.manager} · {app.date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              Edit answers
            </Button>
          )}
          <Button variant="secondary" disabled={!!busy} onClick={() => run("pdf", async () => download(await api.pdf(answers), `${base}.pdf`))}>
            {busy === "pdf" ? "Preparing…" : "Export PDF"}
          </Button>
          <Button variant="secondary" disabled={!!busy} onClick={() => run("xlsx", async () => download(await api.xlsx(answers), `${base}.xlsx`))}>
            {busy === "xlsx" ? "Preparing…" : "Export Excel"}
          </Button>
          {onNew && <Button onClick={onNew}>+ New assessment</Button>}
        </div>
      </div>
      {notice}
      {error && <p className="rounded border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-[#7a4700]">{error}</p>}

      {/* Headline: 6R + score */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="6R recommendation" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <SixRBadge code={rec.code} headline={rec.headline} large />
            <RatingPill rating={result.cloud_suitability.suitable ? "cloud_ready" : "na"} label={result.cloud_suitability.label} />
          </div>
          <p className="mt-3 text-sm text-slate-600">{rec.definition}</p>
          {phase1.triggered && (
            <p className="mt-2 text-xs text-slate-500">
              Primary recommendation set by a hard filter. The tech stack and score below are for roadmap planning.
            </p>
          )}
          {rec.rule === 0 && (
            <p className="mt-2 text-xs font-medium text-amber-800">
              No 6R rule matched exactly — review this recommendation manually.
            </p>
          )}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold text-slate-800">Why</h4>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {rec.rationale.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              {rec.notes.map((n) => (
                <p key={n} className="mt-2 rounded-md bg-warning/15 px-3 py-2 text-xs font-medium text-amber-900">
                  ! {n}
                </p>
              ))}
            </div>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-slate-800">Next steps</h4>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {rec.next_steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
        </Card>
        <Card title="Cloud native score">
          <div className="flex justify-center py-4">
            <Gauge score={phase3.total} max={phase3.max} band={phase3.band} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Phase 1 — Hard filters">
          <div className="mb-3">
            {phase1.triggered ? <RatingPill rating="not_suitable" label="TRIGGERED" /> : <RatingPill rating="cloud_ready" label="PASS" />}
          </div>
          {phase1.triggered ? (
            <ul className="space-y-2 text-sm">
              {phase1.filters.map((f) => (
                <li key={f.id} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-slate-800">{f.reason}</p>
                  <p className="text-xs text-slate-500">{f.outcome}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No automatic disqualifiers apply.</p>
          )}
        </Card>

        <Card title="Phase 2 — Tech stack cloud suitability">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5 font-medium">Component</th>
                <th className="py-1.5 font-medium">Input</th>
                <th className="py-1.5 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody>
              {phase2.components.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-slate-600">{c.label}</td>
                  <td className="py-2 pr-2">
                    <div className="text-slate-800">{c.input}</div>
                    <div className="text-xs text-slate-400">{c.matched}</div>
                  </td>
                  <td className="py-2">
                    <RatingPill rating={c.rating} label={c.rating_label} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 font-semibold text-slate-800" colSpan={2}>
                  Overall tech stack
                </td>
                <td className="pt-3">
                  <RatingPill
                    rating={phase2.overall === "fully_ready" ? "cloud_ready" : phase2.overall === "conditional" ? "needs_upgrade" : "not_suitable"}
                    label={phase2.overall_label}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Phase 3 — Score breakdown">
          <table className="w-full text-sm">
            <tbody>
              {phase3.dimensions.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-600">{d.label}</td>
                  <td className="py-1.5 pr-2 text-xs text-slate-500">{d.answer}</td>
                  <td className="w-32 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(d.score / d.weight) * 100}%` }} />
                      </div>
                      <span className="w-10 text-right tabular-nums text-slate-700">
                        {d.score}/{d.weight}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-semibold text-slate-800" colSpan={2}>
                  Total — {phase3.band.label}
                </td>
                <td className="pt-2 text-right font-semibold tabular-nums">
                  {phase3.total}/{phase3.max}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Key risks & flags">
          {risks.length ? (
            <ul className="space-y-2">
              {risks.map((r) => {
                const s = SEVERITY[r.severity];
                return (
                  <li key={r.message} className="flex gap-3 text-sm">
                    <span className={`inline-flex h-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${s.cls}`}>
                      <span aria-hidden>{s.icon}</span>
                      {s.label}
                    </span>
                    <span className="text-slate-700">{r.message}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">None identified.</p>
          )}
        </Card>
      </div>

      {result.additional_info.length > 0 && (
        <Card title="Additional information">
          <dl className="space-y-3 text-sm">
            {result.additional_info.map((a) => (
              <div key={a.section}>
                <dt className="font-semibold text-ink">{a.section}</dt>
                <dd className="whitespace-pre-line text-ink-muted">{a.text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card title="6R definitions">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {SIX_R_ORDER.map((code) => (
            <div key={code} className={`rounded-lg p-3 ${code === rec.code ? "bg-brand-50 ring-1 ring-brand-600" : "bg-slate-50"}`}>
              <dt className="font-semibold capitalize text-slate-800">{code}</dt>
              <dd className="text-slate-600">{result.six_r_definitions[code]}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Text report">
        {report ? (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">{report}</pre>
        ) : (
          <Button variant="secondary" disabled={!!busy} onClick={() => run("text", async () => setReport(await api.textReport(answers)))}>
            Show report in the agent's text format
          </Button>
        )}
      </Card>
    </div>
  );
}
