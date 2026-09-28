import type { Result } from "../types";
import Gauge from "./Gauge";
import { Card, RatingPill, SixRBadge } from "./ui";

export default function ScorePreview({ result, loading }: { result: Result | null; loading: boolean }) {
  if (!result) {
    return (
      <Card title="Live score">
        <p className="text-sm text-slate-500">{loading ? "Calculating…" : "Start answering to see the score."}</p>
      </Card>
    );
  }
  const { phase1, phase2, phase3, recommendation, complete } = result;
  const answered = phase3.dimensions.filter((d) => d.answered).length;

  return (
    <Card
      title={
        <span className="flex items-center justify-between">
          Live score
          <span className={`text-[10px] font-medium normal-case ${loading ? "text-brand-600" : "text-slate-400"}`}>
            {loading ? "updating…" : complete ? "all required answered" : "preliminary"}
          </span>
        </span>
      }
    >
      <Gauge score={phase3.total} max={phase3.max} band={phase3.band} size={190} />

      <ul className="mt-4 space-y-2">
        {phase3.dimensions.map((d) => (
          <li key={d.id} title={`${d.label}: ${d.answer}`}>
            <div className="flex justify-between text-xs">
              <span className={d.answered ? "text-slate-600" : "text-slate-400"}>{d.short}</span>
              <span className="tabular-nums text-slate-700">
                {d.score}/{d.weight}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
              <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${(d.score / d.weight) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-400">
        {answered} of {phase3.dimensions.length} scoring inputs answered.
      </p>

      <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-500">Hard filters</dt>
          <dd>
            {phase1.triggered ? (
              <RatingPill rating="not_suitable" label="Triggered" />
            ) : (
              <RatingPill rating="cloud_ready" label="Pass" />
            )}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-500">Tech stack</dt>
          <dd>
            <RatingPill
              rating={
                phase2.overall === "fully_ready" ? "cloud_ready" : phase2.overall === "conditional" ? "needs_upgrade" : "not_suitable"
              }
              label={phase2.overall_label}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-500">6R {complete ? "" : "(so far)"}</dt>
          <dd>
            <SixRBadge code={recommendation.code} headline={recommendation.headline} />
          </dd>
        </div>
      </dl>
    </Card>
  );
}
