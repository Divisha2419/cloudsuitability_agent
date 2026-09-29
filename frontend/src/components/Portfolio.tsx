import { useEffect, useRef, useState } from "react";
import { api, download } from "../api";
import type { BatchResponse, Summary } from "../types";
import { Button, Card, RatingPill, SixRBadge } from "./ui";

interface Props {
  onOpen: (id: number) => void;
  onNew: () => void;
}

export default function Portfolio({ onOpen, onNew }: Props) {
  const [items, setItems] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    api
      .list()
      .then(setItems)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  async function remove(s: Summary) {
    if (!confirm(`Delete the assessment for "${s.app_name}"?`)) return;
    await api.remove(s.id).catch((e) => setError(e.message));
    load();
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      setBatch(await api.batch(file));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const ranked = [...(items ?? [])].sort((a, b) => b.score - a.score);
  const counts = ranked.reduce<Record<string, number>>((acc, s) => {
    acc[s.recommendation_headline] = (acc[s.recommendation_headline] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Portfolio</h2>
          <p className="text-sm text-slate-500">Saved assessments, ranked by Cloud Native Score.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={!items?.length} onClick={async () => download(await api.portfolioXlsx(), "cloud_suitability_portfolio.xlsx")}>
            Export portfolio (Excel)
          </Button>
          <Button onClick={onNew}>+ New assessment</Button>
        </div>
      </div>
      {error && <p className="rounded border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-[#7a4700]">{error}</p>}

      {Object.keys(counts).length > 0 && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(counts).map(([headline, n]) => (
            <div key={headline} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-2xl font-semibold tabular-nums text-slate-900">{n}</div>
              <div className="text-xs font-medium text-slate-500">{headline}</div>
            </div>
          ))}
        </div>
      )}

      <Card>
        {items === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : ranked.length === 0 ? (
          <p className="text-sm text-slate-500">No saved assessments yet. Complete an assessment and choose "Save to portfolio", or upload a batch file below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-2 font-medium">#</th>
                  <th className="py-2 pr-2 font-medium">Application</th>
                  <th className="py-2 pr-2 text-right font-medium">Score</th>
                  <th className="py-2 pr-2 font-medium">Band</th>
                  <th className="py-2 pr-2 font-medium">Hard filter</th>
                  <th className="py-2 pr-2 font-medium">Tech stack</th>
                  <th className="py-2 pr-2 font-medium">6R</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, i) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 pr-2 tabular-nums text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <button className="font-medium text-brand-700 hover:underline" onClick={() => onOpen(s.id)}>
                        {s.app_name}
                      </button>
                      <div className="text-xs text-slate-400">
                        {[s.app_id, s.manager].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right font-semibold tabular-nums">{s.score}</td>
                    <td className="py-2 pr-2 text-xs text-slate-600">{s.band.label}</td>
                    <td className="py-2 pr-2">
                      <RatingPill rating={s.phase1 === "PASS" ? "cloud_ready" : "not_suitable"} label={s.phase1} />
                    </td>
                    <td className="py-2 pr-2 text-xs text-slate-600">{s.phase2}</td>
                    <td className="py-2 pr-2">
                      <SixRBadge code={s.recommendation} headline={s.recommendation_headline} />
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="danger" className="px-2 py-1" onClick={() => remove(s)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Batch assessment">
        <p className="text-sm text-slate-600">
          Upload a CSV or Excel file with one application per row. Column headers can be the field labels or IDs; the template
          has dropdowns for every fixed-value field and a sheet listing allowed values. Complete rows are assessed and added to
          the portfolio.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={async () => download(await api.batchTemplate(), "cloud_suitability_batch_template.xlsx")}>
            Download Excel template
          </Button>
          <Button disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Assessing…" : "Upload CSV / Excel"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xlsm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </div>

        {batch && (
          <div className="mt-5 space-y-4">
            <p className="text-sm font-medium text-slate-700">
              {batch.assessed} of {batch.total} rows assessed{batch.rejected.length ? `, ${batch.rejected.length} need fixing` : ""}.
            </p>
            {batch.ranked.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                      <th className="py-2 pr-2 font-medium">Rank</th>
                      <th className="py-2 pr-2 font-medium">Application</th>
                      <th className="py-2 pr-2 text-right font-medium">Score</th>
                      <th className="py-2 pr-2 font-medium">Band</th>
                      <th className="py-2 pr-2 font-medium">6R</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.ranked.map((r, i) => (
                      <tr key={r.row} className="border-b border-slate-100">
                        <td className="py-2 pr-2 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2 pr-2">{r.app_name}</td>
                        <td className="py-2 pr-2 text-right font-semibold tabular-nums">{r.score}</td>
                        <td className="py-2 pr-2 text-xs text-slate-600">{r.band.label}</td>
                        <td className="py-2 pr-2">
                          <SixRBadge code={r.recommendation} headline={r.recommendation_headline} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {batch.rejected.length > 0 && (
              <div className="rounded border border-warning/40 bg-warning/10 p-3 text-sm text-[#7a4700]">
                <p className="mb-1 font-medium">Rows not assessed:</p>
                <ul className="space-y-1">
                  {batch.rejected.map((r) => (
                    <li key={r.row}>
                      Row {r.row} ({r.app_name || "no name"}):{" "}
                      {Object.entries(r.errors)
                        .map(([f, m]) => `${f} — ${m}`)
                        .join("; ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
