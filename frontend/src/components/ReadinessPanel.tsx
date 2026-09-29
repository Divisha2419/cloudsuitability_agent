import { isVisible } from "../form";
import type { Answers, Rating, Result, Schema } from "../types";
import { RATING_STYLE } from "./ui";

// Side panel shown next to the intake form:
//   1. Data Completeness — one overall bar, then one bar per group in
//      config/attributes.yaml → completeness_groups.
//   2. Technology Stack Compatibility — one bar per component, coloured once
//      the user has entered it (rating comes from the backend).
//   3. On-Premise Dependencies — listed only when an answer creates one.

interface Props {
  schema: Schema;
  answers: Answers;
  result: Result | null;
  loading: boolean;
}

const filled = (answers: Answers, id: string) => !!(answers[id] ?? "").trim();

function Bar({ value, total, className = "bg-brand-400" }: { value: number; total: number; className?: string }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="h-2 rounded-full bg-[var(--color-track)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value}>
      <div className={`h-2 rounded-full transition-all duration-300 ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Heading({ children }: { children: string }) {
  return <h4 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-brand-700">{children}</h4>;
}

const TECH = [
  { component: "operating_system", field: "operating_system", label: "Operating System" },
  { component: "database", field: "database", label: "Database" },
  { component: "programming_language", field: "programming_language", label: "Programming Language" },
  { component: "app_server", field: "app_server", label: "App/Web Server" },
] as const;

const RATING_TEXT: Record<Rating, string> = {
  cloud_ready: "Cloud compatible",
  needs_upgrade: "Upgrade required",
  not_suitable: "Not cloud compatible",
  na: "Not applicable",
};

const norm = (s: string) => s.split(/\s+/).filter(Boolean).join(" ");

export default function ReadinessPanel({ schema, answers, result, loading }: Props) {
  const sections = Object.fromEntries(schema.sections.map((s) => [s.id, s]));
  const groups = schema.completeness_groups.map((g) => {
    const fields = g.sections.flatMap((sid) => sections[sid].fields).filter((f) => isVisible(f, answers));
    const mandatory = fields.filter((f) => f.required);
    return {
      label: g.label,
      total: fields.length,
      done: fields.filter((f) => filled(answers, f.id)).length,
      mandatory: mandatory.length,
      mandatoryDone: mandatory.filter((f) => filled(answers, f.id)).length,
    };
  });
  const total = groups.reduce((n, g) => n + g.total, 0);
  const done = groups.reduce((n, g) => n + g.done, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const ratings = Object.fromEntries((result?.phase2.components ?? []).map((c) => [c.id, c]));
  const isCots = answers.cots_or_custom === "COTS";
  const deps = result?.on_premise_dependencies ?? [];

  return (
    <section className="overflow-hidden rounded-md border border-ink-line bg-white shadow-sm">
      <h3 className="flex items-center justify-between bg-brand-700 px-5 py-2.5 text-[15px] font-bold text-white">
        Assessment Readiness
        {loading && <span className="text-[11px] font-normal text-brand-100">updating…</span>}
      </h3>

      <div className="space-y-5 p-5">
        {/* 1. Data completeness */}
        <div>
          <Heading>Data Completeness</Heading>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-ink">{pct}%</span>
            <span className="text-xs text-ink-muted">
              {done} of {total} attributes provided
            </span>
          </div>
          <Bar value={done} total={total} className="bg-brand-700" />

          <ul className="mt-4 space-y-3">
            {groups.map((g) => (
              <li key={g.label}>
                <div className="mb-1 flex items-start justify-between gap-3 text-[13px]">
                  <span className="leading-tight text-ink">
                    {g.label}
                    <span className="block text-[11px] text-ink-muted">
                      Mandatory {g.mandatoryDone}/{g.mandatory}
                      {g.mandatory > 0 && g.mandatoryDone === g.mandatory && <span className="ml-1 font-bold text-good">✓</span>}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-ink">
                    {g.done}/{g.total}
                  </span>
                </div>
                <Bar value={g.done} total={g.total} />
              </li>
            ))}
          </ul>
        </div>

        <hr className="border-ink-line" />

        {/* 2. Technology stack compatibility */}
        <div>
          <Heading>Technology Stack Compatibility</Heading>
          <ul className="space-y-3">
            {TECH.filter((t) => !(t.component === "programming_language" && isCots)).map((t) => {
              const text = norm(answers[t.field] ?? "");
              const c = ratings[t.component];
              const current = !!text && c && norm(c.input) === text;
              const style = current ? RATING_STYLE[c.rating] : null;
              return (
                <li key={t.component}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                    <span className="text-ink">{t.label}</span>
                    <span className={`text-[11px] ${style ? "font-semibold" : "text-ink-muted"}`}>
                      {!text ? "Awaiting input" : current ? RATING_TEXT[c.rating] : "Checking…"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-[var(--color-track)]">
                      {style && <div className={`h-2 w-full rounded-full ${style.bar}`} />}
                    </div>
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        style ? `${style.bar} text-white` : "bg-[var(--color-track)] text-transparent"
                      }`}
                    >
                      {style?.icon ?? "·"}
                    </span>
                  </div>
                  {current && c.verification_required && (
                    <p className="mt-1 text-[11px] text-ink-muted">Not in the lookup table: version to be verified.</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <hr className="border-ink-line" />

        {/* 3. On-premise dependencies */}
        <div>
          <Heading>On-Premise Dependencies</Heading>
          {deps.length ? (
            <ul className="space-y-2">
              {deps.map((d) => (
                <li key={d.id} className="flex gap-2.5 rounded bg-dblue-50 px-3 py-2 text-[13px]">
                  <span aria-hidden className="mt-0.5 text-dblue-700">
                    ◆
                  </span>
                  <span>
                    <span className="font-semibold text-ink">{d.label}</span>
                    {d.detail && <span className="block text-[12px] text-ink-muted">{d.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-muted">None identified so far.</p>
          )}
        </div>
      </div>
    </section>
  );
}
